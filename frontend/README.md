# TruthLens Frontend

This is the frontend application for TruthLens, an AI-powered misinformation detection system. Built with React and Tailwind CSS.

## Features

- **Modern UI**: Clean, responsive design with Tailwind CSS
- **Authentication**: Secure login and registration system
- **Analysis Tools**: Text, URL, and image analysis interfaces
- **Educational Content**: Media literacy tips and guidance
- **Real-time Results**: Interactive analysis results display

## Technology Stack

- **React 19**: Modern React with hooks and context
- **Tailwind CSS**: Utility-first CSS framework
- **Axios**: HTTP client for API communication
- **React Router**: Client-side routing
- **Radix UI**: Accessible component primitives

## Available Scripts

### `npm start`

Runs the app in development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

### `npm test`

Launches the test runner in the interactive watch mode.

## Environment Variables

Create a `.env` file in the frontend directory:

```
REACT_APP_BACKEND_URL=http://localhost:8001
```

## Project Structure

```
src/
├── components/          # Reusable UI components
│   └── ui/             # Radix UI components
├── hooks/              # Custom React hooks
├── lib/                # Utility functions
├── App.js              # Main application component
├── App.css             # Global styles
├── index.js            # Application entry point
└── index.css           # Base styles
```

## Key Components

- **AuthProvider**: Authentication context and state management
- **Dashboard**: Main application interface
- **TextAnalyzer**: Text content analysis interface
- **URLAnalyzer**: URL credibility checking interface
- **ImageAnalyzer**: Image analysis interface
- **ResultCard**: Analysis results display

## Styling

The application uses Tailwind CSS for styling with a custom design system:

- **Colors**: Blue primary theme with semantic color coding
- **Typography**: Clean, readable font hierarchy
- **Layout**: Responsive grid system
- **Components**: Consistent spacing and interaction patterns

## API Integration

The frontend communicates with the backend API through:

- **Authentication**: JWT token-based authentication
- **Analysis**: RESTful API calls for content analysis
- **User Data**: User profile and history management
- **Error Handling**: Comprehensive error handling and user feedback

## Deployment

### Build for Production

```bash
npm run build
```

### Deploy to Vercel

1. Install Vercel CLI: `npm i -g vercel`
2. Run: `vercel`
3. Follow the prompts

### Deploy to Netlify

1. Build the project: `npm run build`
2. Upload the `build` folder to Netlify
3. Set environment variables in Netlify dashboard

## Contributing

1. Follow the existing code style
2. Use meaningful component and variable names
3. Add comments for complex logic
4. Test your changes thoroughly
5. Update documentation as needed

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
