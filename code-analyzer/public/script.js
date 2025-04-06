document.addEventListener('DOMContentLoaded', function() {
    let editor;
    
    // Initialize Monaco Editor
    require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.36.1/min/vs' }});
    require(['vs/editor/editor.main'], function() {
        // Set initial content based on language
        const initialContent = {
            javascript: '// Write your JavaScript code here\nconsole.log("Hello, world!");',
            python: '# Write your Python code here\nprint("Hello, world!")',
            cpp: '// Write your C++ code here\n#include <iostream>\n\nint main() {\n    std::cout << "Hello, world!" << std::endl;\n    return 0;\n}',
            java: '// Write your Java code here\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, world!");\n    }\n}'
        };
        
        const currentLanguage = document.getElementById('languageSelect').value;
        
        editor = monaco.editor.create(document.getElementById('editor'), {
            value: initialContent[currentLanguage] || initialContent.javascript,
            language: currentLanguage,
            theme: 'vs-dark',
            fontSize: 14,
            minimap: { enabled: true },
            automaticLayout: true,
            lineNumbers: 'on',
            roundedSelection: false,
            scrollBeyondLastLine: false,
            readOnly: false,
            cursorStyle: 'line',
            wordWrap: 'on',
            autoIndent: 'full',
            formatOnType: true,
            formatOnPaste: true,
            snippetSuggestions: 'on',
            suggestOnTriggerCharacters: true,
            acceptSuggestionOnEnter: 'on'
        });
        
        // Add custom keyboard shortcuts
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, function() {
            // Save functionality (could be implemented to local storage)
            const notification = document.createElement('div');
            notification.className = 'notification';
            notification.textContent = 'Code saved to browser storage';
            document.body.appendChild(notification);
            
            // Save to localStorage
            localStorage.setItem('savedCode', editor.getValue());
            localStorage.setItem('savedLanguage', document.getElementById('languageSelect').value);
            
            // Remove notification after 2 seconds
            setTimeout(() => notification.remove(), 2000);
        });
        
        // Load previously saved code if available
        if (localStorage.getItem('savedCode')) {
            const savedLanguage = localStorage.getItem('savedLanguage') || 'javascript';
            document.getElementById('languageSelect').value = savedLanguage;
            editor.setValue(localStorage.getItem('savedCode'));
            monaco.editor.setModelLanguage(editor.getModel(), savedLanguage);
        }
        
        // Add keyboard shortcut for running code (Ctrl+Enter)
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, function() {
            document.getElementById('runBtn').click();
        });
        
        // Add keyboard shortcut for analyzing code (Ctrl+Shift+A)
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyA, function() {
            document.getElementById('analyzeBtn').click();
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
        const language = e.target.value;
        monaco.editor.setModelLanguage(editor.getModel(), language);
        
        // Provide language-specific templates when changing to empty editor
        if (editor.getValue().trim() === '') {
            const templates = {
                javascript: '// Write your JavaScript code here\nconsole.log("Hello, world!");',
                python: '# Write your Python code here\nprint("Hello, world!")',
                cpp: '// Write your C++ code here\n#include <iostream>\n\nint main() {\n    std::cout << "Hello, world!" << std::endl;\n    return 0;\n}',
                java: '// Write your Java code here\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, world!");\n    }\n}'
            };
            
            editor.setValue(templates[language] || '');
        }
    });
    
    // Analyze button
    document.getElementById('analyzeBtn').addEventListener('click', () => {
        const code = editor.getValue();
        if (!code.trim()) {
            showNotification('Please enter some code to analyze', 'warning');
            return;
        }
        
        const loader = document.getElementById('loader');
        loader.style.display = 'block';
        
        fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Server responded with an error');
            }
            return response.json();
        })
        .then(data => {
            loader.style.display = 'none';
            displayResults(data);
            showNotification('Analysis complete!', 'success');
        })
        .catch(error => {
            loader.style.display = 'none';
            console.error('Error:', error);
            showNotification('An error occurred during analysis', 'error');
        });
    });
    
    // Run button
    document.getElementById('runBtn').addEventListener('click', () => {
        const code = editor.getValue();
        const output = document.getElementById('output');
        const language = document.getElementById('languageSelect').value;
        
        output.textContent = '';
        
        // Only JavaScript can be executed in the browser
        if (language !== 'javascript') {
            output.textContent = `Cannot execute ${language} code in the browser. Only JavaScript can be run directly.`;
            return;
        }
        
        try {
            // Create a sandbox for executing the code safely
            const sandbox = {
                console: {
                    log: function(...args) {
                        const message = args.map(arg => {
                            if (typeof arg === 'object') {
                                return JSON.stringify(arg, null, 2);
                            }
                            return String(arg);
                        }).join(' ');
                        output.textContent += message + '\n';
                    },
                    error: function(...args) {
                        const message = args.map(arg => String(arg)).join(' ');
                        output.textContent += 'ERROR: ' + message + '\n';
                    },
                    warn: function(...args) {
                        const message = args.map(arg => String(arg)).join(' ');
                        output.textContent += 'WARNING: ' + message + '\n';
                    }
                },
                alert: function(msg) {
                    output.textContent += 'ALERT: ' + msg + '\n';
                }
            };
            
            // Add a timeout to prevent infinite loops
            const timeoutMS = 5000;
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Script execution timed out')), timeoutMS);
            });
            
            // Execute the code with a timeout
            Promise.race([
                new Promise(resolve => {
                    const result = new Function('console', 'alert', code).call(sandbox, sandbox.console, sandbox.alert);
                    resolve(result);
                }),
                timeoutPromise
            ]).catch(error => {
                output.textContent += `Error: ${error.message}`;
            });
            
        } catch (error) {
            output.textContent = `Error: ${error.message}`;
        }
    });
    
    // Clear button
    document.getElementById('clearBtn').addEventListener('click', () => {
        if (confirm('Are you sure you want to clear the editor and results?')) {
            editor.setValue('');
            document.getElementById('output').textContent = '';
            document.getElementById('debugContent').textContent = '';
            document.getElementById('language').textContent = '';
            document.getElementById('complexity').textContent = '';
            document.getElementById('complexityExplanation').textContent = '';
            
            showNotification('Editor and results cleared', 'info');
        }
    });
    
    // Function to display notifications
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // Add close button
        const closeBtn = document.createElement('span');
        closeBtn.className = 'close-notification';
        closeBtn.innerHTML = '&times;';
        closeBtn.onclick = () => notification.remove();
        notification.appendChild(closeBtn);
        
        // Auto remove after 3 seconds
        setTimeout(() => notification.remove(), 3000);
    }
    
    // Display results
    function displayResults(data) {
        document.getElementById('language').textContent = data.language === 'unidentified' ? 
            'Could not identify the language' : data.language;
        document.getElementById('complexity').textContent = data.complexity.complexity;
        document.getElementById('complexityExplanation').textContent = data.complexity.explanation;
        
        const debugContent = document.getElementById('debugContent');
        if (data.debugResults && data.debugResults.length > 0) {
            debugContent.innerHTML = data.debugResults.map(error => `
                <div class="error-item">
                    <div class="error-header">
                        <strong>Line ${error.line}:</strong> ${error.message}
                        <button class="goto-line-btn" data-line="${error.line}">Go to Line</button>
                    </div>
                    <div class="error-suggestion">${error.suggestion}</div>
                </div>
            `).join('');
            
            // Add click event for "Go to Line" buttons
            document.querySelectorAll('.goto-line-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const lineNumber = parseInt(btn.getAttribute('data-line'));
                    if (!isNaN(lineNumber)) {
                        editor.revealLineInCenter(lineNumber);
                        editor.setPosition({lineNumber: lineNumber, column: 1});
                        editor.focus();
                    }
                });
            });
        } else {
            debugContent.innerHTML = '<div class="success-message">No issues found</div>';
        }
    }
    
    // Add keyboard shortcuts info
    function addShortcutsInfo() {
        const shortcutsBtn = document.createElement('button');
        shortcutsBtn.id = 'shortcutsBtn';
        shortcutsBtn.className = 'btn';
        shortcutsBtn.innerHTML = '<i class="fas fa-keyboard"></i>';
        shortcutsBtn.title = 'Keyboard Shortcuts';
        
        const rightControls = document.querySelector('.right-controls');
        rightControls.prepend(shortcutsBtn);
        
        shortcutsBtn.addEventListener('click', () => {
            const shortcutsModal = document.createElement('div');
            shortcutsModal.className = 'modal';
            shortcutsModal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Keyboard Shortcuts</h3>
                        <span class="close-modal">&times;</span>
                    </div>
                    <div class="modal-body">
                        <table class="shortcuts-table">
                            <tr>
                                <td><kbd>Ctrl</kbd> + <kbd>S</kbd></td>
                                <td>Save code to browser storage</td>
                            </tr>
                            <tr>
                                <td><kbd>Ctrl</kbd> + <kbd>Enter</kbd></td>
                                <td>Run code</td>
                            </tr>
                            <tr>
                                <td><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>A</kbd></td>
                                <td>Analyze code</td>
                            </tr>
                            <tr>
                                <td><kbd>Ctrl</kbd> + <kbd>Space</kbd></td>
                                <td>Show code suggestions</td>
                            </tr>
                            <tr>
                                <td><kbd>F1</kbd></td>
                                <td>Show command palette</td>
                            </tr>
                        </table>
                    </div>
                </div>
            `;
            
            document.body.appendChild(shortcutsModal);
            
            const closeBtn = shortcutsModal.querySelector('.close-modal');
            closeBtn.addEventListener('click', () => shortcutsModal.remove());
            
            // Close when clicking outside the modal
            window.addEventListener('click', (e) => {
                if (e.target === shortcutsModal) {
                    shortcutsModal.remove();
                }
            });
        });
    }
    
    // Add example code button
    function addExampleCodeButton() {
        const examplesBtn = document.createElement('button');
        examplesBtn.id = 'examplesBtn';
        examplesBtn.className = 'btn';
        examplesBtn.innerHTML = '<i class="fas fa-code"></i> Examples';
        examplesBtn.title = 'Load Example Code';
        
        const leftControls = document.querySelector('.left-controls');
        leftControls.appendChild(examplesBtn);
        
        const examples = {
            javascript: {
                'Hello World': 'console.log("Hello, world!");',
                'Factorial': 'function factorial(n) {\n  if (n <= 1) return 1;\n  return n * factorial(n - 1);\n}\n\nconsole.log(factorial(5));',
                'Binary Search': 'function binarySearch(arr, target) {\n  let left = 0;\n  let right = arr.length - 1;\n  \n  while (left <= right) {\n    const mid = Math.floor((left + right) / 2);\n    \n    if (arr[mid] === target) {\n      return mid;\n    } else if (arr[mid] < target) {\n      left = mid + 1;\n    } else {\n      right = mid - 1;\n    }\n  }\n  \n  return -1;\n}\n\nconst numbers = [1, 3, 5, 7, 9, 11, 13, 15];\nconsole.log(binarySearch(numbers, 7));'
            },
            python: {
                'Hello World': 'print("Hello, world!")',
                'Factorial': 'def factorial(n):\n    if n <= 1:\n        return 1\n    return n * factorial(n - 1)\n\nprint(factorial(5))',
                'Binary Search': 'def binary_search(arr, target):\n    left, right = 0, len(arr) - 1\n    \n    while left <= right:\n        mid = (left + right) // 2\n        \n        if arr[mid] == target:\n            return mid\n        elif arr[mid] < target:\n            left = mid + 1\n        else:\n            right = mid - 1\n    \n    return -1\n\nnumbers = [1, 3, 5, 7, 9, 11, 13, 15]\nprint(binary_search(numbers, 7))'
            },
            cpp: {
                'Hello World': '#include <iostream>\n\nint main() {\n    std::cout << "Hello, world!" << std::endl;\n    return 0;\n}',
                'Factorial': '#include <iostream>\n\nint factorial(int n) {\n    if (n <= 1) return 1;\n    return n * factorial(n - 1);\n}\n\nint main() {\n    std::cout << factorial(5) << std::endl;\n    return 0;\n}',
                'Binary Search': '#include <iostream>\n#include <vector>\n\nint binary_search(const std::vector<int>& arr, int target) {\n    int left = 0;\n    int right = arr.size() - 1;\n    \n    while (left <= right) {\n        int mid = left + (right - left) / 2;\n        \n        if (arr[mid] == target) {\n            return mid;\n        } else if (arr[mid] < target) {\n            left = mid + 1;\n        } else {\n            right = mid - 1;\n        }\n    }\n    \n    return -1;\n}\n\nint main() {\n    std::vector<int> numbers = {1, 3, 5, 7, 9, 11, 13, 15};\n    std::cout << binary_search(numbers, 7) << std::endl;\n    return 0;\n}'
            },
            java: {
                'Hello World': 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, world!");\n    }\n}',
                'Factorial': 'public class Main {\n    public static int factorial(int n) {\n        if (n <= 1) return 1;\n        return n * factorial(n - 1);\n    }\n    \n    public static void main(String[] args) {\n        System.out.println(factorial(5));\n    }\n}',
                'Binary Search': 'public class Main {\n    public static int binarySearch(int[] arr, int target) {\n        int left = 0;\n        int right = arr.length - 1;\n        \n        while (left <= right) {\n            int mid = left + (right - left) / 2;\n            \n            if (arr[mid] == target) {\n                return mid;\n            } else if (arr[mid] < target) {\n                left = mid + 1;\n            } else {\n                right = mid - 1;\n            }\n        }\n        \n        return -1;\n    }\n    \n    public static void main(String[] args) {\n        int[] numbers = {1, 3, 5, 7, 9, 11, 13, 15};\n        System.out.println(binarySearch(numbers, 7));\n    }\n}'
            }
        };
        
        examplesBtn.addEventListener('click', () => {
            const currentLanguage = document.getElementById('languageSelect').value;
            const languageExamples = examples[currentLanguage] || examples.javascript;
            
            // Create dropdown menu for examples
            const menu = document.createElement('div');
            menu.className = 'examples-menu';
            
            for (const [name, code] of Object.entries(languageExamples)) {
                const item = document.createElement('div');
                item.className = 'example-item';
                item.textContent = name;
                item.addEventListener('click', () => {
                    editor.setValue(code);
                    menu.remove();
                });
                menu.appendChild(item);
            }
            
            document.body.appendChild(menu);
            
            // Position the menu below the examples button
            const rect = examplesBtn.getBoundingClientRect();
            menu.style.top = `${rect.bottom}px`;
            menu.style.left = `${rect.left}px`;
            
            // Close menu when clicking outside
            const closeMenu = (e) => {
                if (!menu.contains(e.target) && e.target !== examplesBtn) {
                    menu.remove();
                    document.removeEventListener('click', closeMenu);
                }
            };
            
            // Add delay to prevent immediate closing
            setTimeout(() => {
                document.addEventListener('click', closeMenu);
            }, 100);
        });
    }
    
    // Add information about the shortcuts and examples
    setTimeout(() => {
        addShortcutsInfo();
        addExampleCodeButton();
    }, 1000);
});