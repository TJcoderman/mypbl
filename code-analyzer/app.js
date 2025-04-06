const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Detects the programming language based on code patterns and keywords
 * @param {string} code - The code to analyze
 * @returns {string} - The detected language: 'cpp', 'java', 'python', or 'unidentified'
 */
function detectLanguage(code) {
  // Normalize code by removing comments and extra whitespace
  const normalizedCode = code.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '').trim();
  
  // Common patterns and keywords for each language
  const cppPatterns = {
    keywords: ['#include', 'using namespace', 'std::', 'cout', 'cin', '->', '::', 'nullptr'],
    extensions: ['.cpp', '.hpp', '.h'],
    syntax: [';$', '{', '}']
  };
  
  const javaPatterns = {
    keywords: ['public class', 'public static void main', 'System.out.println', 'import java.', 'extends', '@Override'],
    syntax: [';$', '{', '}', 'new '],
    negatives: ['#include', 'def ', 'elif', 'print(']
  };
  
  const pythonPatterns = {
    keywords: ['def ', 'import ', 'from ', 'if __name__ == "__main__"', 'print(', 'elif', 'class ', 'self'],
    indentation: /^\s{2,4}\w+/m,
    negatives: [';$', '#include', 'public class', 'void', 'int main']
  };
  
  // Count pattern matches for each language
  let scores = {
    cpp: 0,
    java: 0,
    python: 0
  };
  
  // Check for C++ patterns
  cppPatterns.keywords.forEach(keyword => {
    if (normalizedCode.includes(keyword)) scores.cpp += 2;
  });
  
  // Strong C++ indicators
  if (normalizedCode.includes('#include')) scores.cpp += 5;
  if (/int\s+main\s*\(\s*(void|int\s+argc,\s*char\s*\*\s*argv\[\])\s*\)/.test(normalizedCode)) scores.cpp += 5;
  
  // Check for Java patterns
  javaPatterns.keywords.forEach(keyword => {
    if (normalizedCode.includes(keyword)) scores.java += 2;
  });
  
  // Strong Java indicators
  if (/public\s+(static\s+)?class/.test(normalizedCode)) scores.java += 5;
  if (/public\s+static\s+void\s+main/.test(normalizedCode)) scores.java += 5;
  
  // Check for Python patterns
  pythonPatterns.keywords.forEach(keyword => {
    if (normalizedCode.includes(keyword)) scores.python += 2;
  });
  
  // Strong Python indicators
  if (pythonPatterns.indentation.test(normalizedCode)) scores.python += 3;
  if (normalizedCode.includes('def __init__(self')) scores.python += 4;
  if (!normalizedCode.includes(';')) scores.python += 2;
  
  // Check negative indicators
  javaPatterns.negatives.forEach(neg => {
    if (normalizedCode.includes(neg)) scores.java -= 2;
  });
  
  pythonPatterns.negatives.forEach(neg => {
    if (normalizedCode.includes(neg)) scores.python -= 2;
  });
  
  // Select language with highest score if above threshold
  const highestScore = Math.max(scores.cpp, scores.java, scores.python);
  if (highestScore >= 3) {
    if (scores.cpp === highestScore) return 'cpp';
    if (scores.java === highestScore) return 'java';
    if (scores.python === highestScore) return 'python';
  }
  
  return 'unidentified';
}

/**
 * Debugs C++ code for common errors
 * @param {string} code - The C++ code to debug
 * @returns {Array} - Array of error objects with line, message, and suggestion
 */
function debugCpp(code) {
  const errors = [];
  const lines = code.split('\n');
  
  // Check for missing semicolons at end of lines
  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmedLine = line.trim();
    
    // Skip comments, preprocessor directives, and empty lines
    if (trimmedLine.startsWith('//') || trimmedLine.startsWith('#') || trimmedLine === '' || 
        trimmedLine.startsWith('{') || trimmedLine.startsWith('}')) {
      return;
    }
    
    // Check for missing semicolons (but avoid false positives)
    if (!trimmedLine.endsWith(';') && !trimmedLine.endsWith('{') && !trimmedLine.endsWith('}') &&
        !trimmedLine.endsWith(':') && !trimmedLine.match(/^\s*for\s*\(.*\)\s*$/)) {
      errors.push({
        line: lineNum,
        message: "Possible missing semicolon",
        suggestion: "Add a semicolon at the end of this line"
      });
    }
    
    // Check for unbalanced parentheses
    const openParens = (trimmedLine.match(/\(/g) || []).length;
    const closeParens = (trimmedLine.match(/\)/g) || []).length;
    if (openParens !== closeParens && !trimmedLine.includes('for') && !trimmedLine.includes('if')) {
      errors.push({
        line: lineNum,
        message: "Unbalanced parentheses",
        suggestion: "Ensure all parentheses are properly matched"
      });
    }
    
    // Check for common C++ pointer/reference errors
    if (trimmedLine.includes('*') && !trimmedLine.includes('=') && 
        trimmedLine.match(/\w+\s*\*\s*\w+/) && !trimmedLine.startsWith('*')) {
      errors.push({
        line: lineNum,
        message: "Potential pointer declaration issue",
        suggestion: "In C++, consider using 'Type* var' or consistent spacing around asterisks"
      });
    }
  });
  
  // Check for missing include statements
  if (code.includes('cout') && !code.includes('#include <iostream>')) {
    errors.push({
      line: 1,
      message: "Using cout without including iostream",
      suggestion: "Add '#include <iostream>' at the top of your file"
    });
  }
  
  if (code.includes('vector') && !code.includes('#include <vector>')) {
    errors.push({
      line: 1,
      message: "Using vector without including vector header",
      suggestion: "Add '#include <vector>' at the top of your file"
    });
  }
  
  // Check for missing namespace
  if (code.includes('cout') && !code.includes('std::') && !code.includes('using namespace std')) {
    errors.push({
      line: 1,
      message: "Using std library without namespace",
      suggestion: "Add 'using namespace std;' or prefix with 'std::'"
    });
  }
  
  return errors;
}

/**
 * Debugs Java code for common errors
 * @param {string} code - The Java code to debug
 * @returns {Array} - Array of error objects with line, message, and suggestion
 */
function debugJava(code) {
  const errors = [];
  const lines = code.split('\n');
  
  // Track class name and file name consistency
  let className = null;
  const classMatch = code.match(/public\s+class\s+(\w+)/);
  if (classMatch) {
    className = classMatch[1];
  }
  
  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmedLine = line.trim();
    
    // Skip comments and empty lines
    if (trimmedLine.startsWith('//') || trimmedLine === '') {
      return;
    }
    
    // Check for missing semicolons
    if (!trimmedLine.endsWith(';') && !trimmedLine.endsWith('{') && !trimmedLine.endsWith('}') &&
        !trimmedLine.startsWith('@') && !trimmedLine.endsWith(':') && 
        trimmedLine.length > 0 && !trimmedLine.startsWith('package') &&
        !trimmedLine.startsWith('import') && !trimmedLine.startsWith('public class')) {
      errors.push({
        line: lineNum,
        message: "Possible missing semicolon",
        suggestion: "Add a semicolon at the end of this line"
      });
    }
    
    // Check for variable declaration issues
    if ((trimmedLine.includes('int ') || trimmedLine.includes('String ') || 
         trimmedLine.includes('boolean ') || trimmedLine.includes('double ')) && 
        !trimmedLine.includes('=') && !trimmedLine.includes('(')) {
      errors.push({
        line: lineNum,
        message: "Variable declared but not initialized",
        suggestion: "Consider initializing this variable with a default value"
      });
    }
    
    // Check for common Java errors
    if (trimmedLine.includes('System.out.print') && !trimmedLine.includes('(')) {
      errors.push({
        line: lineNum,
        message: "Incorrect System.out.print usage",
        suggestion: "Use parentheses: System.out.println()"
      });
    }
  });
  
  // Check for class name consistency
  if (className && code.toLowerCase().includes(`class ${className.toLowerCase()}`)) {
    errors.push({
      line: 1,
      message: "Java is case-sensitive with class names",
      suggestion: `Ensure class name '${className}' is used consistently throughout your code`
    });
  }
  
  // Check for missing main method
  if (code.includes('public class') && !code.includes('public static void main')) {
    errors.push({
      line: 1,
      message: "No main method found",
      suggestion: "Add 'public static void main(String[] args) { }' to make your class executable"
    });
  }
  
  return errors;
}

/**
 * Debugs Python code for common errors
 * @param {string} code - The Python code to debug
 * @returns {Array} - Array of error objects with line, message, and suggestion
 */
function debugPython(code) {
  const errors = [];
  const lines = code.split('\n');
  let currentIndentation = 0;
  let expectedIndentation = [];
  
  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmedLine = line.trim();
    
    // Skip comments and empty lines
    if (trimmedLine.startsWith('#') || trimmedLine === '') {
      return;
    }
    
    // Check indentation consistency
    const leadingSpaces = line.length - line.trimLeft().length;
    
    // Track code blocks
    if (trimmedLine.endsWith(':')) {
      expectedIndentation.push(currentIndentation + 4); // Python standard is 4 spaces
      currentIndentation += 4;
    } else if (index > 0 && lines[index-1].trim() !== '' && 
               leadingSpaces < currentIndentation && expectedIndentation.length > 0) {
      // Dedent detected
      while (expectedIndentation.length > 0 && leadingSpaces < currentIndentation) {
        expectedIndentation.pop();
        currentIndentation = expectedIndentation.length > 0 ? expectedIndentation[expectedIndentation.length - 1] : 0;
      }
    }
    
    // Only check lines that aren't empty
    if (trimmedLine !== '') {
      // If we're in a block and indentation doesn't match expected
      if (expectedIndentation.length > 0 && leadingSpaces !== currentIndentation && 
          leadingSpaces !== 0) { // Allow global scope
        errors.push({
          line: lineNum,
          message: "Inconsistent indentation",
          suggestion: `Expected ${currentIndentation} spaces, got ${leadingSpaces}`
        });
      }
    }
    
    // Check for missing colons
    if ((trimmedLine.startsWith('if ') || trimmedLine.startsWith('elif ') || 
         trimmedLine.startsWith('else') || trimmedLine.startsWith('for ') || 
         trimmedLine.startsWith('while ') || trimmedLine.startsWith('def ') || 
         trimmedLine.startsWith('class ')) && !trimmedLine.endsWith(':')) {
      errors.push({
        line: lineNum,
        message: "Missing colon at the end of statement",
        suggestion: "Add ':' at the end of this line"
      });
    }
    
    // Check for common Python errors
    if (trimmedLine.includes('print ') && !trimmedLine.includes('print(')) {
      errors.push({
        line: lineNum,
        message: "Incorrect print syntax (Python 3)",
        suggestion: "Use print() with parentheses in Python 3"
      });
    }
    
    // Check for improper variable naming
    if (/\b[A-Z][a-z]*\s*=/.test(trimmedLine) && !trimmedLine.includes('class')) {
      errors.push({
        line: lineNum,
        message: "Non-conventional variable naming",
        suggestion: "In Python, variables typically use snake_case rather than CamelCase"
      });
    }
  });
  
  return errors;
}

/**
 * Analyzes the time complexity of code based on language and loop structures
 * @param {string} code - The code to analyze
 * @param {string} language - The detected language
 * @returns {Object} - Object containing complexity assessment and explanation
 */
function analyzeComplexity(code, language) {
  let complexity = "O(1)";
  let explanation = "No loops or recursive functions found.";
  
  // Remove comments to simplify analysis
  const cleanCode = code.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '').replace(/#.*$/gm, '');
  
  // Improved detection of loops and nesting
  let maxNesting = 0;
  let currentNesting = 0;
  const lines = cleanCode.split('\n');
  lines.forEach(line => {
    if (/\b(for|while)\b/.test(line)) {
      // Increase nesting for detected loop line
      currentNesting++;
      maxNesting = Math.max(maxNesting, currentNesting);
    }
    // For C++/Java, assume closing brace reduces nesting
    if ((language === 'cpp' || language === 'java') && line.includes('}')) {
      currentNesting = Math.max(currentNesting - 1, 0);
    }
    // For Python, use indentation-based nesting level (assume 4 spaces per level)
    if (language === 'python') {
      const indentMatch = line.match(/^(\s+)/);
      let indent = indentMatch ? indentMatch[1].length : 0;
      let level = Math.floor(indent / 4);
      maxNesting = Math.max(maxNesting, level);
    }
  });
  
  // Check for recursion by identifying function definitions and multiple calls
  let recursionDetected = false;
  const functionNames = [];
  const functionRegex = /function\s+(\w+)|def\s+(\w+)/g;
  let match;
  while ((match = functionRegex.exec(cleanCode)) !== null) {
    const name = match[1] || match[2];
    if (name) {
      functionNames.push(name);
    }
  }
  for (const fname of functionNames) {
    const callRegex = new RegExp('\\b' + fname + '\\s*\\(', 'g');
    const callCount = (cleanCode.match(callRegex) || []).length;
    // Declaration counts as one call; more than one implies potential recursion
    if (callCount > 1) {
      recursionDetected = true;
      break;
    }
  }
  
  if (recursionDetected) {
    complexity = "O(2^n)";
    explanation = "Recursive function calls detected, which may lead to exponential complexity.";
  } else if (maxNesting > 0) {
    // Determine complexity based on maximum nesting level
    switch (maxNesting) {
      case 1:
        complexity = "O(n)";
        explanation = "A single level loop detected.";
        break;
      case 2:
        complexity = "O(n²)";
        explanation = "Two levels of nested loops detected.";
        break;
      case 3:
        complexity = "O(n³)";
        explanation = "Three levels of nested loops detected.";
        break;
      default:
        complexity = `O(n^${maxNesting})`;
        explanation = `${maxNesting} levels of nested loops detected.`;
    }
  } else {
    const totalLoops = (cleanCode.match(/\b(for|while)\b/g) || []).length;
    if (totalLoops > 0) {
      complexity = "O(n)";
      explanation = `${totalLoops} non-nested loop(s) detected.`;
    }
  }
  
  // Specific algorithm adjustments (if applicable)
  if (cleanCode.includes('quickSort') || cleanCode.includes('quick_sort')) {
    complexity = "O(n log n) average, O(n²) worst case";
    explanation = "Quick sort algorithm detected.";
  } else if (cleanCode.includes('mergeSort') || cleanCode.includes('merge_sort')) {
    complexity = "O(n log n)";
    explanation = "Merge sort algorithm detected.";
  } else if (/binary\s*search/i.test(cleanCode)) {
    complexity = "O(log n)";
    explanation = "Binary search algorithm detected.";
  }
  
  const algorithmPatterns = {
    quickSort: /(?:quick_?sort|partition)/i,
    mergeSort: /merge_?sort/i,
    binarySearch: /binary_?search/i,
    bubbleSort: /bubble_?sort/i,
    insertionSort: /insertion_?sort/i,
    dfs: /(?:depth_?first|dfs)/i,
    bfs: /(?:breadth_?first|bfs)/i,
    dijkstra: /dijkstra/i,
    fibonacci: /fibonacci|fib\(/i
  };

  // Process each line for complexity
  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    
    // Check for loop starts
    if ((/\b(for|while)\b/.test(trimmedLine) && trimmedLine.includes('(')) || 
        (language === 'python' && /\bfor\b.*\bin\b/.test(trimmedLine))) {
        
        // Get indentation level for Python
        let currentNesting = 0;
        if (language === 'python') {
            const spaces = line.match(/^\s*/)[0].length;
            currentNesting = Math.floor(spaces / 4);
        } else {
            currentNesting = nestingStack.length;
        }
        
        nestingStack.push({
            type: 'loop',
            nesting: currentNesting
        });
        
        maxNesting = Math.max(maxNesting, nestingStack.length);
    }
    
    // Track brace/block endings
    if ((language === 'cpp' || language === 'java' || language === 'javascript') && 
        trimmedLine.includes('}')) {
        if (nestingStack.length > 0) nestingStack.pop();
    }
    
    // Check for recursive function calls
    if (trimmedLine.match(/\b(\w+)\s*\(.*\)/)) {
        const funcName = RegExp.$1;
        if (cleanCode.match(new RegExp(`\\b${funcName}\\s*\\([^)]*\\)`, 'g')).length > 1) {
            nestingStack.push({ type: 'recursion' });
        }
    }
  });

  // Determine complexity based on nesting and patterns
  let baseComplexity = '';
  let additionalInfo = [];

  // Check for specific algorithms first
  for (const [algo, pattern] of Object.entries(algorithmPatterns)) {
    if (pattern.test(cleanCode)) {
        switch (algo) {
            case 'quickSort':
                return {
                    complexity: 'O(n log n) average, O(n²) worst case',
                    explanation: 'QuickSort algorithm detected - Average case is O(n log n), worst case is O(n²)'
                };
            case 'mergeSort':
                return {
                    complexity: 'O(n log n)',
                    explanation: 'MergeSort algorithm detected - Consistent O(n log n) complexity'
                };
            case 'binarySearch':
                return {
                    complexity: 'O(log n)',
                    explanation: 'Binary Search algorithm detected - Logarithmic time complexity'
                };
            case 'bubbleSort':
            case 'insertionSort':
                return {
                    complexity: 'O(n²)',
                    explanation: `${algo.replace(/([A-Z])/g, ' $1').trim()} algorithm detected - Quadratic time complexity`
                };
            case 'dfs':
            case 'bfs':
                return {
                    complexity: 'O(V + E)',
                    explanation: `${algo.toUpperCase()} graph traversal detected - Linear in terms of vertices (V) and edges (E)`
                };
            case 'dijkstra':
                return {
                    complexity: 'O((V + E) log V)',
                    explanation: "Dijkstra's algorithm detected - Complexity depends on graph implementation"
                };
            case 'fibonacci':
                if (cleanCode.includes('recursion') || nestingStack.some(item => item.type === 'recursion')) {
                    return {
                        complexity: 'O(2ⁿ)',
                        explanation: 'Recursive Fibonacci implementation detected - Exponential complexity'
                    };
                }
        }
    }
  }

  // Analyze based on nesting depth if no specific algorithm was detected
  if (nestingStack.some(item => item.type === 'recursion')) {
    baseComplexity = 'O(2ⁿ)';
    explanation = 'Recursive function calls detected - Potentially exponential complexity';
  } else {
    switch (maxNesting) {
        case 0:
            baseComplexity = 'O(1)';
            explanation = 'Constant time - No loops or recursion detected';
            break;
        case 1:
            baseComplexity = 'O(n)';
            explanation = 'Linear time - Single loop detected';
            break;
        case 2:
            baseComplexity = 'O(n²)';
            explanation = 'Quadratic time - Nested loops detected';
            break;
        case 3:
            baseComplexity = 'O(n³)';
            explanation = 'Cubic time - Triple nested loops detected';
            break;
        default:
            baseComplexity = `O(n^${maxNesting})`;
            explanation = `Polynomial time - ${maxNesting} levels of nested loops detected`;
    }
  }

  // Add any additional complexity factors
  if (cleanCode.includes('sort(')) {
    additionalInfo.push('Built-in sorting operations are typically O(n log n)');
  }

  if (cleanCode.match(/Map|Set|Object|dict/)) {
    additionalInfo.push('Hash table operations are generally O(1) for lookups');
  }

  return {
    complexity: baseComplexity,
    explanation: explanation + (additionalInfo.length ? '\nNote: ' + additionalInfo.join('. ') : '')
  };
}

/**
 * Function to tokenize code for additional analysis
 * @param {string} code - The code to tokenize
 * @param {string} language - The detected language
 * @returns {Array} - Array of tokens
 */
function tokenizeCode(code, language) {
  // Basic tokenization based on language
  let tokens = [];
  
  // Remove comments first
  let cleanCode = code;
  if (language === 'cpp' || language === 'java') {
    cleanCode = code.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
  } else if (language === 'python') {
    cleanCode = code.replace(/#.*$/gm, '');
  }
  
  // Simple tokenizer (for demonstration purposes)
  // A more robust tokenizer would use regular expressions specifically tailored to each language
  const lines = cleanCode.split('\n');
  lines.forEach((line, lineNum) => {
    // Split by spaces and punctuation but keep punctuation as tokens
    const lineTokens = line.split(/(\s+|[;{}()\[\]\.,<>:=+\-*/%&|^!~?])/g)
      .filter(token => token.trim() !== '');
      
    lineTokens.forEach(token => {
      if (token.trim() !== '') {
        tokens.push({
          value: token,
          line: lineNum + 1,
          type: categorizeToken(token, language)
        });
      }
    });
  });
  
  return tokens;
}

/**
 * Helper function to categorize tokens
 * @param {string} token - The token to categorize
 * @param {string} language - The detected language
 * @returns {string} - Token category
 */
function categorizeToken(token, language) {
  // Common keywords for each language
  const cppKeywords = ['auto', 'break', 'case', 'class', 'const', 'continue', 'default', 'delete', 
                       'do', 'else', 'enum', 'explicit', 'for', 'if', 'inline', 'new', 'nullptr',
                       'private', 'protected', 'public', 'return', 'static', 'struct', 'switch', 
                       'template', 'this', 'typedef', 'using', 'virtual', 'void', 'while'];
                       
  const javaKeywords = ['abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char', 
                        'class', 'const', 'continue', 'default', 'do', 'double', 'else', 'enum',
                        'extends', 'final', 'finally', 'float', 'for', 'if', 'implements', 'import',
                        'instanceof', 'int', 'interface', 'long', 'native', 'new', 'package',
                        'private', 'protected', 'public', 'return', 'short', 'static', 'strictfp',
                        'super', 'switch', 'synchronized', 'this', 'throw', 'throws', 'transient',
                        'try', 'void', 'volatile', 'while'];
                        
  const pythonKeywords = ['and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 
                          'def', 'del', 'elif', 'else', 'except', 'False', 'finally', 'for', 'from',
                          'global', 'if', 'import', 'in', 'is', 'lambda', 'None', 'nonlocal', 'not',
                          'or', 'pass', 'raise', 'return', 'True', 'try', 'while', 'with', 'yield'];
  
  // Select the appropriate keyword list based on language
  let keywords = [];
  if (language === 'cpp') keywords = cppKeywords;
  else if (language === 'java') keywords = javaKeywords;
  else if (language === 'python') keywords = pythonKeywords;
  
  // Check if token is a keyword
  if (keywords.includes(token.trim())) {
    return 'keyword';
  }
  
  // Check if token is an operator
  if (/^[+\-*/%=&|^<>!~?:]+$/.test(token)) {
    return 'operator';
  }
  
  // Check if token is a number
  if (/^[0-9]+(\.[0-9]+)?$/.test(token)) {
    return 'number';
  }
  
  // Check if token is a string literal (simplified)
  if ((token.startsWith('"') && token.endsWith('"')) || 
      (token.startsWith("'") && token.endsWith("'"))) {
    return 'string';
  }
  
  // Check if token is a delimiter
  if (/^[;{}()\[\].,]$/.test(token)) {
    return 'delimiter';
  }
  
  // Check if token is an identifier (simplified)
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(token)) {
    return 'identifier';
  }
  
  // Default
  return 'other';
}

// API Routes
app.post('/api/analyze', (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'No code provided' });
    }
    
    // Detect language
    const language = detectLanguage(code);
    
    // Perform language-specific debugging
    let debugResults = [];
    if (language === 'cpp') {
      debugResults = debugCpp(code);
    } else if (language === 'java') {
      debugResults = debugJava(code);
    } else if (language === 'python') {
      debugResults = debugPython(code);
    }
    
    // Analyze complexity
    const complexityAnalysis = analyzeComplexity(code, language);
    
    // Tokenize code (for additional features)
    const tokens = tokenizeCode(code, language);
    
    // Prepare and send response
    res.json({
      language,
      debugResults,
      complexity: complexityAnalysis,
      tokenCount: tokens.length,
      success: true
    });
  } catch (error) {
    console.error('Error analyzing code:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Serve the main HTML page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app; // For testing purposes