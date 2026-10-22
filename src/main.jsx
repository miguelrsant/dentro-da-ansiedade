import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

// three.js loads with the stage (src/v2/stage.js), so the text and the preloader paint first.
createRoot(document.getElementById('root')).render(<App />);
