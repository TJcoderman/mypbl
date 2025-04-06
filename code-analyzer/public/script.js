document.addEventListener('DOMContentLoaded', function() {
    let editor;
    
    // Initialize Monaco Editor
    require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.36.1/min/vs' }});
    require(['vs/editor/editor.main'], function() {
        editor = monaco.editor.create(document.getElementById('editor'), {
            value: '// Write your code here',
            language: 'javascript',
            theme: 'vs-dark',
            fontSize: 14,
            minimap: { enabled: true },
            automaticLayout: true,
            lineNumbers: 'on',
            roundedSelection: false,
            scrollBeyondLastLine: false,
            readOnly: false,
            cursorStyle: 'line',
            wordWrap: 'on'
        });
        
        // Handle window resize
        window.addEventListener('resize', () => editor.layout());
    });
    
    // Theme toggle
    const themeToggle = document.getElementById('themeToggle');
    let isDark = true;
    
    themeToggle.addEventListener('click', () => {
        isDark = !isDark;
        document.body.className = isDark ? 'dark-theme' : 'light-theme';
        monaco.editor.setTheme(isDark ? 'vs-dark' : 'vs-light');
        themeToggle.innerHTML = isDark ? 
            '<i class="fas fa-moon"></i>' : 
            '<i class="fas fa-sun"></i>';
    });
    
    // Language selection
    document.getElementById('languageSelect').addEventListener('change', (e) => {
        monaco.editor.setModelLanguage(editor.getModel(), e.target.value);
    });
    
    // Analyze button
    document.getElementById('analyzeBtn').addEventListener('click', () => {
        const code = editor.getValue();
        if (!code.trim()) {
            alert('Please enter some code to analyze');
            return;
        }
        
        const loader = document.getElementById('loader');
        loader.style.display = 'block';
        
        fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        })
        .then(response => response.json())
        .then(data => {
            loader.style.display = 'none';
            displayResults(data);
        })
        .catch(error => {
            loader.style.display = 'none';
            console.error('Error:', error);
            alert('An error occurred during analysis');
        });
    });
    
    // Run button
    document.getElementById('runBtn').addEventListener('click', () => {
        const code = editor.getValue();
        const output = document.getElementById('output');
        output.textContent = '';
        
        try {
            // Redirect console.log
            const oldLog = console.log;
            console.log = (...args) => {
                output.textContent += args.join(' ') + '\n';
                oldLog.apply(console, args);
            };
            
            eval(code);
            
            // Restore console.log
            console.log = oldLog;
        } catch (error) {
            output.textContent = `Error: ${error.message}`;
        }
    });
    
    // Clear button
    document.getElementById('clearBtn').addEventListener('click', () => {
        editor.setValue('');
        document.getElementById('output').textContent = '';
        document.getElementById('debugContent').textContent = '';
        document.getElementById('language').textContent = '';
        document.getElementById('complexity').textContent = '';
        document.getElementById('complexityExplanation').textContent = '';
    });
    
    // Display results
    function displayResults(data) {
        document.getElementById('language').textContent = data.language;
        document.getElementById('complexity').textContent = data.complexity.complexity;
        document.getElementById('complexityExplanation').textContent = data.complexity.explanation;
        
        const debugContent = document.getElementById('debugContent');
        if (data.debugResults && data.debugResults.length > 0) {
            debugContent.innerHTML = data.debugResults.map(error => `
                <div class="error-item">
                    <strong>Line ${error.line}:</strong> ${error.message}<br>
                    <small>${error.suggestion}</small>
                </div>
            `).join('');
        } else {
            debugContent.innerHTML = '<div class="success">No issues found</div>';
        }
    }
});