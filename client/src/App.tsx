import React from 'react';
import PDFViewer from './components/PDFViewer';
import './App.css';

function App() {
  return (
    <div className="app-container">
      <header className="app-header">
        <h1>BoloForms</h1>
        <span className="header-subtitle">Signature Injection Engine</span>
      </header>
      <main className="main-content">
        <PDFViewer file={`/sample.pdf?t=${Date.now()}`} />
      </main>
    </div>
  );
}

export default App;
