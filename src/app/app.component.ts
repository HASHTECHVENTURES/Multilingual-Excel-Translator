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
  
  // API Key Management
  savedApiKeys: string[] = [];
  selectedApiKeyIndex: number = -1;
  newApiKey: string = '';
  showApiKeyManager: boolean = false;
  
  // State management
  isLoading: boolean = false;
  showResults: boolean = false;
  showTranslatedView: boolean = true;
  
  // Lazy loading states
  translationProgress: {
    currentChunk: number;
    totalChunks: number;
    currentStep: string;
    isProcessing: boolean;
  } = {
    currentChunk: 0,
    totalChunks: 0,
    currentStep: '',
    isProcessing: false
  };
  
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
    this.loadSavedApiKeys();
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
    this.translationProgress = {
      currentChunk: 0,
      totalChunks: 0,
      currentStep: 'Initializing translation...',
      isProcessing: true
    };
    
    try {
      this.translatedData = await this.translationService.translateDataWithProgress(
        this.originalData,
        this.originalHeaders,
        this.customPrompt,
        this.selectedLanguage,
        this.apiKey,
        (progress) => {
          this.translationProgress = progress;
        }
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
      this.translationProgress.isProcessing = false;
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

  get progressPercentage(): number {
    if (this.translationProgress.totalChunks === 0) return 0;
    return Math.round((this.translationProgress.currentChunk / this.translationProgress.totalChunks) * 100);
  }

  get isTranslationInProgress(): boolean {
    return this.translationProgress.isProcessing;
  }

  // API Key Management Methods
  loadSavedApiKeys(): void {
    const saved = localStorage.getItem('savedApiKeys');
    if (saved) {
      this.savedApiKeys = JSON.parse(saved);
      // Add the default API key if it's not already saved
      const defaultKey = 'AIzaSyA-deNpVWylrXvs8JiNZTEvIwkipAbm35c';
      if (!this.savedApiKeys.includes(defaultKey)) {
        this.savedApiKeys.unshift(defaultKey);
        this.saveApiKeys();
      }
    } else {
      // Initialize with the default API key
      this.savedApiKeys = ['AIzaSyA-deNpVWylrXvs8JiNZTEvIwkipAbm35c'];
      this.saveApiKeys();
    }
  }

  saveApiKeys(): void {
    localStorage.setItem('savedApiKeys', JSON.stringify(this.savedApiKeys));
  }

  addNewApiKey(): void {
    if (this.newApiKey.trim() && this.isValidApiKey(this.newApiKey.trim())) {
      if (!this.savedApiKeys.includes(this.newApiKey.trim())) {
        this.savedApiKeys.unshift(this.newApiKey.trim());
        this.saveApiKeys();
        this.newApiKey = '';
        this.translationService.updateStatus('API key added successfully!', false);
      } else {
        this.translationService.updateStatus('This API key is already saved.', true);
      }
    } else {
      this.translationService.updateStatus('Please enter a valid API key.', true);
    }
  }

  selectApiKey(index: number): void {
    this.selectedApiKeyIndex = index;
    this.apiKey = this.savedApiKeys[index];
  }

  removeApiKey(index: number): void {
    if (this.savedApiKeys.length > 1) {
      this.savedApiKeys.splice(index, 1);
      this.saveApiKeys();
      if (this.selectedApiKeyIndex === index) {
        this.selectedApiKeyIndex = 0;
        this.apiKey = this.savedApiKeys[0];
      } else if (this.selectedApiKeyIndex > index) {
        this.selectedApiKeyIndex--;
      }
      this.translationService.updateStatus('API key removed successfully!', false);
    } else {
      this.translationService.updateStatus('Cannot remove the last API key.', true);
    }
  }

  toggleApiKeyManager(): void {
    this.showApiKeyManager = !this.showApiKeyManager;
  }

  get maskedApiKey(apiKey: string): string {
    if (apiKey.length <= 8) return apiKey;
    return apiKey.substring(0, 4) + '••••••••' + apiKey.substring(apiKey.length - 4);
  }
}
