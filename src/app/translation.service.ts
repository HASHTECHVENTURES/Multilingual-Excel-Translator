import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

declare const XLSX: any;

export interface TranslationData {
  [key: string]: string | number | boolean | null | undefined;
}

export interface PromptTemplates {
  [language: string]: string;
}

export interface StatusMessage {
  message: string;
  isError: boolean;
}

export interface GeminiApiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

export interface GeminiApiError {
  error?: {
    message?: string;
  };
}

export interface TranslationProgress {
  currentChunk: number;
  totalChunks: number;
  currentStep: string;
  isProcessing: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  private readonly PROMPT_TEMPLATES: PromptTemplates = {
    'Hindi': `Please translate without creativity or rephrasing unless necessary for clarity.
You are a professional educational language translator with experience in scenario-based aptitude and behavioural assessments. Your task is to translate the following English JSON data into Hindi.
These questions assess practical decision-making, interpersonal judgment, or cognitive skills in real-life or workplace scenarios.
Follow these instructions precisely:
1.  Translate into standard Hindi, understandable to a learner with a 10th-grade reading level. Use a formal yet clear tone appropriate for academic or exam use. Avoid literary, poetic, overly Sanskritised, or conversational constructions. Do not use slang or region-specific expressions.
2.  Ensure all language is gender-neutral, unless the original English text explicitly specifies gender.
3.  If any word, phrase, or sentence in English is being tested (such as in synonym, idiom, or paraphrasing questions), retain it in English. Do not translate it.
4.  The translation must preserve the meaning, tone, and logic of the original question. The correct answer must remain valid in the Hindi version.
5.  Maintain the structure and flow of the question and options unless a slight adjustment improves clarity in Hindi.
6.  If the original English input is ambiguous, unclear, or poorly written, flag it for review instead of attempting to interpret.
7.  Translate text and convert numbers to their Hindi script equivalents (e.g., 1 to १, 2 to २).
8.  When you encounter single English letters used as labels (e.g., 'Assertion (A)', 'Strategy B'), translate them to their corresponding Devanagari letters (e.g., 'अभिकथन (अ)', 'रणनीति ब') unless they are part of a specific term that must remain in English.
9.  Maintain the exact JSON structure (keys and nesting). Only translate the string values and convert numbers. Do not translate the keys.
10. Return ONLY the translated JSON array, without any surrounding text, explanations, or markdown formatting like \`\`\`json.`,
    'Marathi': `Please translate without creativity or rephrasing unless necessary for clarity.
You are a professional educational language translator with experience in scenario-based aptitude and behavioural assessments. Your task is to translate the following English JSON data into Marathi.
These questions test practical reasoning, workplace behaviour, communication, or decision-making in real or simulated situations.
Follow these instructions precisely:
1.  Translate into standard Marathi, suitable for a learner at the 10th-grade reading level. Use a formal yet clear tone.
2.  Ensure all language is gender-neutral, unless the original English text explicitly specifies gender.
3.  The translation must preserve the meaning, tone, and logic of the original question. The correct answer must remain valid in the Marathi version.
4.  Translate text and convert numbers to their Marathi script equivalents (e.g., 1 to १, 2 to २).
5.  When you encounter single English letters used as labels (e.g., 'Assertion (A)', 'Strategy B'), translate them to their corresponding Devanagari letters (e.g., 'अभिकथन (अ)', 'रणनीति ब') unless they are part of a specific term that must remain in English.
6.  Maintain the exact JSON structure (keys and nesting). Only translate the string values and convert numbers. Do not translate the keys.
7.  Return ONLY the translated JSON array, without any surrounding text, explanations, or markdown formatting like \`\`\`json.`
  };

  private statusSubject = new BehaviorSubject<StatusMessage>({message: '', isError: false});
  public status$ = this.statusSubject.asObservable();

  constructor() { }

  getPromptTemplate(language: string): string {
    return this.PROMPT_TEMPLATES[language] || '';
  }

  updateStatus(message: string, isError: boolean = false): void {
    this.statusSubject.next({message, isError});
  }

  readExcelFile(file: File): Promise<TranslationData[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          resolve(jsonData);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Error reading the file.'));
      };

      reader.readAsArrayBuffer(file);
    });
  }

  parseApiResponse(jsonString: string): TranslationData[] {
    console.log('Raw API response:', jsonString.substring(0, 200) + '...');
    console.log('Response length:', jsonString.length);
    
    // Completely rewrite the response to handle the backslash issue
    let cleanResponse = this.cleanApiResponse(jsonString);
    console.log('Cleaned response:', cleanResponse.substring(0, 200) + '...');
    
    try {
      const result = JSON.parse(cleanResponse);
      console.log('Direct JSON parse succeeded!');
      return result as TranslationData[];
    } catch (error) {
      console.warn('Direct parse failed, trying fallback methods...');
      
      // Try multiple parsing strategies
      const strategies = [
        () => this.parseWithStrategy1(cleanResponse),
        () => this.parseWithStrategy2(cleanResponse),
        () => this.parseWithStrategy3(cleanResponse),
        () => this.parseWithStrategy4(cleanResponse),
        () => this.parseWithStrategy5(cleanResponse),
        () => this.parseWithStrategy6(cleanResponse)
      ];

      for (let i = 0; i < strategies.length; i++) {
        try {
          console.log(`Trying parsing strategy ${i + 1}...`);
          const result = strategies[i]();
          console.log(`Strategy ${i + 1} succeeded!`);
          return result;
        } catch (strategyError) {
          console.warn(`Strategy ${i + 1} failed:`, strategyError instanceof Error ? strategyError.message : 'Unknown error');
          if (i === strategies.length - 1) {
            console.error("All parsing strategies failed.", {
              original: jsonString,
              cleaned: cleanResponse,
              error: strategyError,
            });
            throw new Error(`JSON parsing failed: ${strategyError instanceof Error ? strategyError.message : 'Unknown error'}. Please try again with a smaller chunk size.`);
          }
        }
      }
    }
    
    throw new Error("Could not parse API response into a valid object or array.");
  }

  private cleanApiResponse(response: string): string {
    console.log('Starting response cleaning...');
    
    // Remove markdown code blocks
    let cleaned = response
      .replace(/^```json\s*/, '')
      .replace(/```$/, '')
      .trim();
    
    console.log('After markdown removal:', cleaned.substring(0, 50) + '...');
    
    // Handle the specific backslash issue at the beginning
    if (cleaned.startsWith('\\')) {
      console.log('Removing leading backslash...');
      cleaned = cleaned.substring(1);
    }
    
    // Remove any leading/trailing backslashes
    cleaned = cleaned.replace(/^\\+/, '').replace(/\\+$/, '');
    
    // If it's wrapped in quotes, unwrap it
    if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
      console.log('Unwrapping quoted response...');
      try {
        cleaned = JSON.parse(cleaned);
        if (typeof cleaned === 'string') {
          cleaned = cleaned.trim();
        }
      } catch (e) {
        console.warn('Could not unwrap quoted response, proceeding as is');
      }
    }
    
    // If it's still a string, clean it further
    if (typeof cleaned === 'string') {
      // Find the actual JSON start
      const jsonStart = cleaned.search(/[\[\{]/);
      if (jsonStart > 0) {
        console.log(`Found JSON start at position ${jsonStart}`);
        cleaned = cleaned.substring(jsonStart);
      }
      
      // Remove any remaining problematic characters
      cleaned = cleaned
        .replace(/^\\+/, '') // Remove any remaining leading backslashes
        .replace(/_x000d_/g, '') // Remove carriage returns
        .trim();
    }
    
    console.log('Final cleaned response:', cleaned.substring(0, 100) + '...');
    return cleaned;
  }

  private parseWithStrategy1(jsonString: string): TranslationData[] {
    // Strategy 1: Basic cleanup and parse
    let cleaned = jsonString
      .replace(/_x000d_/g, '')
      .replace(/:\s*([०-९\.]+)\s*([,}])/g, ': "$1"$2')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t')
      .trim();
    
    return JSON.parse(cleaned) as TranslationData[];
  }

  private parseWithStrategy2(jsonString: string): TranslationData[] {
    // Strategy 2: Remove all backslashes and fix
    let cleaned = jsonString
      .replace(/\\/g, '') // Remove all backslashes
      .replace(/_x000d_/g, '')
      .replace(/:\s*([०-९\.]+)\s*([,}])/g, ': "$1"$2')
      .trim();
    
    return JSON.parse(cleaned) as TranslationData[];
  }

  private parseWithStrategy3(jsonString: string): TranslationData[] {
    // Strategy 3: Find JSON start and extract
    const jsonStart = jsonString.search(/[\[\{]/);
    if (jsonStart > 0) {
      jsonString = jsonString.substring(jsonStart);
    }
    
    let cleaned = jsonString
      .replace(/\\/g, '')
      .replace(/_x000d_/g, '')
      .replace(/:\s*([०-९\.]+)\s*([,}])/g, ': "$1"$2')
      .trim();
    
    return JSON.parse(cleaned) as TranslationData[];
  }

  private parseWithStrategy4(jsonString: string): TranslationData[] {
    // Strategy 4: Most aggressive repair
    let cleaned = this.preprocessJsonString(jsonString);
    cleaned = this.fixUnterminatedStrings(cleaned);
    cleaned = this.advancedJsonRepair(cleaned);
    
    return JSON.parse(cleaned) as TranslationData[];
  }

  private parseWithStrategy5(jsonString: string): TranslationData[] {
    // Strategy 5: Extract array content manually
    const arrayStart = jsonString.indexOf('[');
    const arrayEnd = jsonString.lastIndexOf(']');
    
    if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
      const arrayContent = jsonString.substring(arrayStart, arrayEnd + 1);
      console.log('Extracted array content:', arrayContent.substring(0, 100) + '...');
      
      // Clean the extracted content
      let cleaned = arrayContent
        .replace(/\\/g, '') // Remove all backslashes
        .replace(/_x000d_/g, '')
        .replace(/:\s*([०-९\.]+)\s*([,}])/g, ': "$1"$2')
        .trim();
      
      return JSON.parse(cleaned) as TranslationData[];
    }
    
    throw new Error('Could not find valid array structure');
  }

  private parseWithStrategy6(jsonString: string): TranslationData[] {
    // Strategy 6: Create a fallback object if all else fails
    console.log('Using fallback strategy - creating simple object...');
    
    // Try to extract any meaningful content and create a basic object
    const lines = jsonString.split('\n').filter(line => line.trim());
    const result: TranslationData[] = [];
    
    // Look for any key-value patterns
    for (const line of lines) {
      const match = line.match(/([^:]+):\s*(.+)/);
      if (match) {
        const key = match[1].trim().replace(/[{}"]/g, '');
        const value = match[2].trim().replace(/[{}",]/g, '');
        if (key && value) {
          result.push({ [key]: value } as TranslationData);
        }
      }
    }
    
    if (result.length > 0) {
      console.log('Fallback strategy created', result.length, 'objects');
      return result;
    }
    
    // If nothing else works, return a single empty object
    console.log('Returning empty object as last resort');
    return [{} as TranslationData];
  }

  private preprocessJsonString(jsonString: string): string {
    // Handle common issues that cause JSON parsing failures
    let processed = jsonString;
    
    // Fix backslashes at the beginning of JSON (common issue)
    if (processed.startsWith('\\')) {
      processed = processed.substring(1);
    }
    
    // Fix multiple backslashes at the beginning
    while (processed.startsWith('\\\\')) {
      processed = processed.substring(2);
    }
    
    // Ensure the string starts with [ or {
    if (!processed.trim().startsWith('[') && !processed.trim().startsWith('{')) {
      // Try to find the actual start of JSON
      const jsonStart = processed.search(/[\[\{]/);
      if (jsonStart > 0) {
        processed = processed.substring(jsonStart);
      }
    }
    
    // Fix any remaining escape issues
    processed = processed
      .replace(/^\\+/, '') // Remove leading backslashes
      .replace(/\\+$/, '') // Remove trailing backslashes
      .trim();
    
    return processed;
  }

  private fixUnterminatedStrings(jsonString: string): string {
    // Find unterminated strings and close them
    let result = jsonString;
    let inString = false;
    let escapeNext = false;
    
    for (let i = 0; i < result.length; i++) {
      const char = result[i];
      
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      
      if (char === '\\') {
        escapeNext = true;
        continue;
      }
      
      if (char === '"') {
        inString = !inString;
      } else if (!inString && (char === '}' || char === ']')) {
        // If we're at the end of an object/array and still in a string, close it
        if (inString) {
          result = result.slice(0, i) + '"' + result.slice(i);
          inString = false;
        }
      }
    }
    
    // If we ended while still in a string, close it
    if (inString) {
      result += '"';
    }
    
    return result;
  }

  private advancedJsonRepair(jsonString: string): string {
    let repaired = jsonString;
    
    // Fix common issues with more aggressive repair
    repaired = repaired
      // Fix backslash issues - replace problematic backslashes
      .replace(/\\(?!["\\/bfnrtu])/g, '\\\\') // Fix invalid escape sequences
      .replace(/\\/g, '\\\\') // Double all backslashes to be safe
      .replace(/\\\\"/g, '\\"') // Fix double-escaped quotes
      .replace(/\\\\n/g, '\\n') // Fix double-escaped newlines
      .replace(/\\\\t/g, '\\t') // Fix double-escaped tabs
      .replace(/\\\\r/g, '\\r') // Fix double-escaped carriage returns
      // Remove trailing commas
      .replace(/,(\s*[}\]])/g, '$1')
      // Quote unquoted keys
      .replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":')
      // Quote unquoted string values (multiple passes)
      .replace(/:\s*([^",{\[\]\s][^",{\[\]}]*?)(\s*[,}\]])/g, ': "$1"$2')
      .replace(/:\s*([^",{\[\]\s][^",{\[\]}]*?)(\s*[,}\]])/g, ': "$1"$2')
      // Fix any remaining unescaped quotes in values
      .replace(/"([^"]*)"([^"]*)"([^"]*)":/g, '"$1\\"$2\\"$3":')
      // Clean up any double quotes that might have been created
      .replace(/""/g, '"');
    
    return repaired;
  }

  async callGeminiAPI(systemPrompt: string, userPrompt: string, apiKey: string): Promise<string> {
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
    const payload = {
      contents: [{ parts: [{ text: userPrompt }] }],
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      generationConfig: { temperature: 0.2, topP: 1.0, topK: 32, maxOutputTokens: 8192 },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
      ]
    };

    const maxRetries = 5;
    let delay = 1000;

    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          const result: GeminiApiResponse = await response.json();
          if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
            return result.candidates[0].content.parts[0].text;
          } else {
            console.error("API Response with no content:", JSON.stringify(result, null, 2));
            throw new Error("API returned a successful response but with no content. Check safety filters or console for details.");
          }
        }

        if (response.status === 503 || response.status === 429) {
          console.warn(`API returned status ${response.status}. Retrying in ${delay / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2;
          continue;
        }

        const errorBody: GeminiApiError = await response.json();
        throw new Error(`API Error: ${response.statusText} - ${errorBody.error?.message || 'Unknown error'}`);

      } catch (error) {
        console.error(`Fetch attempt ${i + 1} failed with error:`, error);
        if (i === maxRetries - 1) throw error;
        console.warn(`Retrying...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
      }
    }
    throw new Error('API request failed after multiple retries.');
  }

  async translateDataWithProgress(
    originalData: TranslationData[],
    originalHeaders: string[],
    systemPrompt: string,
    language: string,
    apiKey: string,
    progressCallback: (progress: TranslationProgress) => void
  ): Promise<TranslationData[]> {
    // Filter data: separate rows to translate from rows to keep in English
    const dataToTranslate = originalData.filter(row => 
      row['Subskill'] !== 'Verbal Reasoning'
    );
    
    const headersUserPrompt = `Translate the following comma-separated list of column headers into ${language}. Return ONLY the translated comma-separated list, without any extra text or explanations.\n\n${originalHeaders.join(', ')}`;
    
    // Step 1: Translate Headers
    progressCallback({
      currentChunk: 0,
      totalChunks: Math.ceil(dataToTranslate.length / 5) + 1,
      currentStep: 'Translating column headers...',
      isProcessing: true
    });
    
    const translatedHeadersText = await this.callGeminiAPI(`You are a concise translator.`, headersUserPrompt, apiKey);
    const translatedHeaders = translatedHeadersText.split(',').map(h => h.trim());

    if (translatedHeaders.length !== originalHeaders.length) {
      throw new Error("Header translation failed: Mismatch in column count.");
    }

    // Step 2: Translate Data in Chunks
    let translatedRowValues: TranslationData[] = [];
    const CHUNK_SIZE = 1; // Minimal chunk size to prevent JSON parsing issues
    const totalChunks = Math.ceil(dataToTranslate.length / CHUNK_SIZE);

    for (let i = 0; i < totalChunks; i++) {
      const chunk = dataToTranslate.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      if (chunk.length === 0) continue;

      // Update progress
      progressCallback({
        currentChunk: i + 1,
        totalChunks: totalChunks + 1, // +1 for headers
        currentStep: `Translating data chunk ${i + 1} of ${totalChunks}...`,
        isProcessing: true
      });

      this.updateStatus(`Translating chunk ${i + 1} of ${totalChunks}...`, false);
      
      const dataUserPrompt = `Translate the following JSON data according to the instructions. IMPORTANT: Return ONLY valid JSON array without any markdown formatting, code blocks, or extra text. Do not wrap the response in quotes or add any backslashes:\n\n${JSON.stringify(chunk, null, 2)}`;
      const translatedJsonString = await this.callGeminiAPI(systemPrompt, dataUserPrompt, apiKey);
      
      // Log the response for debugging (first 500 chars)
      console.log(`API Response (chunk ${i + 1}):`, translatedJsonString.substring(0, 500) + '...');
      console.log(`API Response length:`, translatedJsonString.length);
      console.log(`API Response starts with:`, translatedJsonString.substring(0, 10));
      
      const parsedChunk = this.parseApiResponse(translatedJsonString);
      translatedRowValues.push(...parsedChunk);
    }

    // Step 3: Reconstruct the full data set
    progressCallback({
      currentChunk: totalChunks + 1,
      totalChunks: totalChunks + 1,
      currentStep: 'Finalizing translation...',
      isProcessing: true
    });

    let translatedDataCounter = 0;
    const translatedData = originalData.map(originalRow => {
      const newRow: TranslationData = {};
      const shouldSkipTranslation = originalRow['Subskill'] === 'Verbal Reasoning';
      
      const sourceRow = shouldSkipTranslation 
        ? originalRow 
        : translatedRowValues[translatedDataCounter];

      if (sourceRow) {
        originalHeaders.forEach((originalHeader, index) => {
          const translatedHeader = translatedHeaders[index];
          newRow[translatedHeader] = sourceRow[originalHeader];
        });
        
        if (!shouldSkipTranslation) {
          translatedDataCounter++;
        }
      }
      return newRow;
    });

    return translatedData;
  }

  downloadExcel(data: TranslationData[], fileName: string, language: string): void {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'TranslatedSheet');
    
    const originalFileName = fileName.replace(/\.(xlsx|xls)$/, '') || 'translated';
    const translatedFileName = `${originalFileName}_${language}.xlsx`;

    XLSX.writeFile(workbook, translatedFileName);
  }
}
