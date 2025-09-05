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
    let dataToParse = jsonString
      .replace(/^```json\s*/, '')
      .replace(/```$/, '')
      .trim();

    if (dataToParse.startsWith('"') && dataToParse.endsWith('"')) {
      try {
        dataToParse = JSON.parse(dataToParse);
      } catch (e) {
        console.warn("Could not unwrap double-stringified JSON, proceeding as is.", e);
      }
    }
    
    if (typeof dataToParse === 'object' && dataToParse !== null) {
      return dataToParse as TranslationData[];
    }

    if (typeof dataToParse === 'string') {
      // Enhanced JSON repair logic
      let fixedJsonString = dataToParse
        .replace(/_x000d_/g, '') // Remove carriage returns
        .replace(/:\s*([०-९\.]+)\s*([,}])/g, ': "$1"$2') // Quote Devanagari numbers
        .replace(/\n/g, '\\n') // Escape newlines
        .replace(/\r/g, '\\r') // Escape carriage returns
        .replace(/\t/g, '\\t'); // Escape tabs

      // Fix unterminated strings by finding and closing them
      fixedJsonString = this.fixUnterminatedStrings(fixedJsonString);

      try {
        return JSON.parse(fixedJsonString) as TranslationData[];
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.warn(`Initial JSON parse failed: "${errorMessage}". Retrying with advanced repairs.`);
        
        try {
          // Advanced repair: fix common JSON issues
          const repairedJson = this.advancedJsonRepair(fixedJsonString);
          return JSON.parse(repairedJson) as TranslationData[];
        } catch (finalError) {
          console.error("All JSON parsing attempts failed.", {
            original: jsonString,
            error: finalError,
          });
          throw new Error(`JSON parsing failed: ${finalError instanceof Error ? finalError.message : 'Unknown error'}. Please try again with a smaller chunk size.`);
        }
      }
    }
    
    throw new Error("Could not parse API response into a valid object or array.");
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
    
    // Fix common issues
    repaired = repaired
      .replace(/\\(?!["\\/bfnrtu])/g, '\\\\') // Fix invalid escape sequences
      .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
      .replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":') // Quote unquoted keys
      .replace(/:\s*([^",{\[\]\s][^",{\[\]}]*?)(\s*[,}\]])/g, ': "$1"$2') // Quote unquoted string values
      .replace(/:\s*([^",{\[\]\s][^",{\[\]}]*?)(\s*[,}\]])/g, ': "$1"$2'); // Second pass for nested quotes
    
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

  async translateData(
    originalData: TranslationData[],
    originalHeaders: string[],
    systemPrompt: string,
    language: string,
    apiKey: string
  ): Promise<TranslationData[]> {
    // Filter data: separate rows to translate from rows to keep in English
    const dataToTranslate = originalData.filter(row => 
      row['Subskill'] !== 'Verbal Reasoning'
    );
    
    const headersUserPrompt = `Translate the following comma-separated list of column headers into ${language}. Return ONLY the translated comma-separated list, without any extra text or explanations.\n\n${originalHeaders.join(', ')}`;
    
    // Step 1: Translate Headers
    const translatedHeadersText = await this.callGeminiAPI(`You are a concise translator.`, headersUserPrompt, apiKey);
    const translatedHeaders = translatedHeadersText.split(',').map(h => h.trim());

    if (translatedHeaders.length !== originalHeaders.length) {
      throw new Error("Header translation failed: Mismatch in column count.");
    }

    // Step 2: Translate Data in Chunks
    let translatedRowValues: TranslationData[] = [];
    const CHUNK_SIZE = 5; // Reduced chunk size to prevent JSON parsing issues
    const totalChunks = Math.ceil(dataToTranslate.length / CHUNK_SIZE);

    for (let i = 0; i < totalChunks; i++) {
      const chunk = dataToTranslate.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      if (chunk.length === 0) continue;

      this.updateStatus(`Translating chunk ${i + 1} of ${totalChunks}...`, false);
      
      const dataUserPrompt = `Translate the following JSON data according to the instructions:\n\n${JSON.stringify(chunk, null, 2)}`;
      const translatedJsonString = await this.callGeminiAPI(systemPrompt, dataUserPrompt, apiKey);
      
      // Log the response for debugging (first 500 chars)
      console.log(`API Response (chunk ${i + 1}):`, translatedJsonString.substring(0, 500) + '...');
      
      const parsedChunk = this.parseApiResponse(translatedJsonString);
      translatedRowValues.push(...parsedChunk);
    }

    // Step 3: Reconstruct the full data set
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
