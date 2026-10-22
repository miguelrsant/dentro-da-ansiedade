import * as THREE from 'three';
import { createRoot } from 'react-dom/client';
import './three/inlineModels.js'; // must run before App's modules start preloading
import App from './App.jsx';
import './styles.css';

// Colours are authored as screen colours, like the reference site.
THREE.ColorManagement.enabled = false;

createRoot(document.getElementById('root')).render(<App />);
