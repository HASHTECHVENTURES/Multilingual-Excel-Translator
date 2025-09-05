import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { TranslationService, TranslationData, StatusMessage } from './translation.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  // Form data
  apiKey: string = '';
  showApiKey: boolean = false;
  selectedFile: File | null = null;
  fileName: string = 'Drag & drop or click to upload';
  selectedLanguage: string = 'Hindi';
  customPrompt: string = '';
  
  // State management
  isLoading: boolean = false;
  showResults: boolean = false;
  showTranslatedView: boolean = true;
  
  // Data
  originalData: TranslationData[] = [];
  translatedData: TranslationData[] = [];
  originalHeaders: string[] = [];
  editedPrompts: { [language: string]: string } = {};
  
  // Status
  statusMessage: string = '';
  isError: boolean = false;
  
  // Subscriptions
  private statusSubscription?: Subscription;

  constructor(private translationService: TranslationService) {}

  ngOnInit(): void {
    this.updatePromptForLanguage();
    this.statusSubscription = this.translationService.status$.subscribe((status: StatusMessage) => {
      this.statusMessage = status.message;
      this.isError = status.isError;
    });
  }

  ngOnDestroy(): void {
    if (this.statusSubscription) {
      this.statusSubscription.unsubscribe();
    }
  }

  toggleApiKeyVisibility(): void {
    this.showApiKey = !this.showApiKey;
  }

  onFileSelected(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      this.handleFileSelect(file);
    }
  }

  onFileDropped(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files[0];
    if (file) {
      this.handleFileSelect(file);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
  }

  private async handleFileSelect(file: File): Promise<void> {
    this.selectedFile = file;
    this.fileName = file.name;
    
    try {
      this.originalData = await this.translationService.readExcelFile(file);
      if (this.originalData.length > 0) {
        this.originalHeaders = Object.keys(this.originalData[0]);
      }
      this.showResults = false;
      this.translationService.updateStatus('File loaded successfully!', false);
    } catch (error) {
      console.error('File reading error:', error);
      this.translationService.updateStatus('Error reading the file.', true);
      this.originalData = [];
      this.originalHeaders = [];
    }
  }

  onLanguageChange(): void {
    this.updatePromptForLanguage();
  }

  onPromptChange(): void {
    this.editedPrompts[this.selectedLanguage] = this.customPrompt;
  }

  private updatePromptForLanguage(): void {
    if (this.editedPrompts[this.selectedLanguage]) {
      this.customPrompt = this.editedPrompts[this.selectedLanguage];
    } else {
      this.customPrompt = this.translationService.getPromptTemplate(this.selectedLanguage);
    }
  }

  async translate(): Promise<void> {
    // Input validation
    if (!this.apiKey.trim()) {
      this.translationService.updateStatus('Please enter your Gemini API key.', true);
      return;
    }
    
    if (!this.isValidApiKey(this.apiKey)) {
      this.translationService.updateStatus('Please enter a valid API key format.', true);
      return;
    }
    
    if (!this.originalData || this.originalData.length === 0) {
      this.translationService.updateStatus('Please upload a valid Excel file with content.', true);
      return;
    }

    this.isLoading = true;
    this.showResults = false;
    
    try {
      this.translatedData = await this.translationService.translateData(
        this.originalData,
        this.originalHeaders,
        this.customPrompt,
        this.selectedLanguage,
        this.apiKey
      );
      
      this.showResults = true;
      this.showTranslatedView = true;
      this.translationService.updateStatus('Translation successful!', false);
    } catch (error: any) {
      console.error('Translation Error:', error);
      const errorMessage = error.message.includes('JSON Parse error') 
        ? `JSON Parse error: The API returned an invalid format. ${error.message}`
        : `Translation failed. Error: ${error.message}. Check console for details.`;
      this.translationService.updateStatus(errorMessage, true);
      this.translatedData = [];
    } finally {
      this.isLoading = false;
    }
  }

  downloadExcel(): void {
    if (!this.translatedData || this.translatedData.length === 0) {
      this.translationService.updateStatus('No translated data available to download.', true);
      return;
    }
    
    const fileName = this.selectedFile?.name || 'translated';
    this.translationService.downloadExcel(this.translatedData, fileName, this.selectedLanguage);
  }

  toggleView(showTranslated: boolean): void {
    this.showTranslatedView = showTranslated;
  }

  get displayData(): TranslationData[] {
    if (this.showTranslatedView && this.translatedData.length > 0) {
      return this.translatedData;
    } else if (this.originalData.length > 0) {
      return this.originalData.map(row => {
        const newRow: TranslationData = {};
        this.originalHeaders.forEach(header => {
          newRow[header] = row[header];
        });
        return newRow;
      });
    }
    return [];
  }

  get displayHeaders(): string[] {
    if (this.showTranslatedView && this.translatedData.length > 0) {
      return Object.keys(this.translatedData[0]);
    } else if (this.originalData.length > 0) {
      return this.originalHeaders;
    }
    return [];
  }

  get statusClasses(): string {
    let classes = 'text-center py-2 text-sm font-medium rounded-lg mb-4';
    if (this.isError) {
      classes += ' bg-red-100 text-red-700';
    } else if (this.statusMessage.includes('successful')) {
      classes += ' bg-green-100 text-green-700';
    } else {
      classes += ' bg-blue-100 text-blue-700';
    }
    return classes;
  }

  private isValidApiKey(apiKey: string): boolean {
    // Basic validation for Gemini API key format
    return apiKey.length > 20 && /^[A-Za-z0-9_-]+$/.test(apiKey);
  }
}
