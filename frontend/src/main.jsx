import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import TestPage from './TestPage.jsx'
import VideoDebugApp from './VideoDebugApp.jsx'

// Check URL parameters
const urlParams = new URLSearchParams(window.location.search);
const showTestPage = urlParams.get('test') === 'true';
const showVideoDebug = urlParams.get('debug') === 'video';

// Choose which component to render
let ComponentToRender = App;
if (showTestPage) ComponentToRender = TestPage;
if (showVideoDebug) ComponentToRender = VideoDebugApp;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ComponentToRender />
  </StrictMode>,
)
