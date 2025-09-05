# Multilingual Excel Translator

A modern Angular application that translates Excel files using Google's Gemini AI API. Upload an Excel file, select a target language (Hindi or Marathi), and get a professionally translated version.

## Features

- 🚀 **Modern Angular 17** with standalone components
- 📊 **Excel File Support** (.xlsx, .xls)
- 🤖 **Gemini AI Integration** for high-quality translations
- 🎯 **Smart Filtering** - Keeps "Verbal Reasoning" content in English
- 📱 **Responsive Design** with Tailwind CSS
- ♿ **Accessibility** features with ARIA labels
- 🔒 **Type Safety** with TypeScript
- 🎨 **Beautiful UI** with Font Awesome icons

## Supported Languages

- **Hindi** - Professional educational translation
- **Marathi** - Workplace and behavioral assessment translation

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)

### Installation

1. **Clone the repository:**
```bash
git clone https://github.com/HASHTECHVENTURES/Multilingual-Excel-Translator.git
cd Multilingual-Excel-Translator
```

2. **Install dependencies:**
```bash
npm install
```

3. **Start the development server:**
```bash
npm start
```

4. **Open your browser:**
Navigate to `http://localhost:4200`

### Building for Production

```bash
npm run build
```

The build artifacts will be stored in the `dist/` directory.

## Usage

1. **Enter API Key**: Input your Gemini API key
2. **Upload File**: Drag & drop or click to upload an Excel file
3. **Select Language**: Choose Hindi or Marathi
4. **Customize Prompt**: Optionally edit the translation prompt
5. **Translate**: Click the translate button
6. **Preview & Download**: Review results and download translated Excel

## Technical Details

### Architecture

- **Component**: `AppComponent` - Main application component
- **Service**: `TranslationService` - Handles API calls and file processing
- **Interfaces**: Type-safe data structures for translation data

### Key Features

- **Chunked Processing**: Large files are processed in chunks of 10 rows
- **Error Handling**: Robust retry logic with exponential backoff
- **Memory Management**: Proper subscription cleanup to prevent memory leaks
- **Input Validation**: API key format validation
- **Accessibility**: Full keyboard navigation and screen reader support

### API Integration

Uses Google's Gemini 2.5 Flash Preview model with:
- Temperature: 0.2 (for consistent translations)
- Max tokens: 8192
- Safety settings: Disabled for translation content

## Development

### Code Quality

- ✅ TypeScript strict mode
- ✅ ESLint configuration
- ✅ Proper error handling
- ✅ Memory leak prevention
- ✅ Accessibility compliance

### File Structure

```
src/
├── app/
│   ├── app.component.html      # Main template
│   ├── app.component.scss      # Component styles
│   ├── app.component.ts        # Main component logic
│   └── translation.service.ts  # API and file handling service
├── index.html                  # Main HTML file
├── main.ts                     # Application bootstrap
└── styles.scss                 # Global styles
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, email support@hashtechventures.com or create an issue in the repository.

## Acknowledgments

- Google Gemini AI for translation capabilities
- Angular team for the excellent framework
- Tailwind CSS for beautiful styling
- Font Awesome for icons
