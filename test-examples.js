// Test examples for the code runner API
// Run this with: node test-examples.js

import axios from 'axios';

const BASE_URL = 'http://localhost:3000';

const testCode = async (language, sourceCode, input = '') => {
  try {
    console.log(`\n🧪 Testing ${language.toUpperCase()}...`);
    
    const response = await axios.post(`${BASE_URL}/run`, {
      language,
      sourceCode,
      input
    });
    
    console.log(`✅ Success!`);
    console.log(`📤 Output: ${response.data.run.stdout.trim()}`);
    if (response.data.run.stderr) {
      console.log(`⚠️  Stderr: ${response.data.run.stderr.trim()}`);
    }
    console.log(`⏱️  Time: ${response.data.run.executionTime}ms`);
    
    return response.data;
  } catch (error) {
    console.error(`❌ Error in ${language}:`, error.response?.data || error.message);
    return null;
  }
};

const runTests = async () => {
  console.log('🚀 Starting Code Runner Tests...\n');
  
  try {
    // Health check
    const health = await axios.get(`${BASE_URL}/health`);
    console.log('💚 Health check:', health.data);
    
    // Get supported languages
    const languages = await axios.get(`${BASE_URL}/languages`);
    console.log('📝 Supported languages:', languages.data.languages.map(l => l.name).join(', '));
    
    // Test each language
    await testCode('python', 'print("Hello, Python!")\nname = input("Enter name: ")\nprint(f"Welcome, {name}!")', 'Alice');
    
    await testCode('c', '#include <stdio.h>\nint main() {\n    char name[50];\n    printf("Hello from C!\\nEnter name: ");\n    scanf("%s", name);\n    printf("Welcome, %s!\\n", name);\n    return 0;\n}', 'Bob');
    
    await testCode('cpp', '#include <iostream>\n#include <string>\nusing namespace std;\nint main() {\n    string name;\n    cout << "Hello from C++!" << endl << "Enter name: ";\n    cin >> name;\n    cout << "Welcome, " << name << "!" << endl;\n    return 0;\n}', 'Charlie');
    
    await testCode('java', 'import java.util.Scanner;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner scanner = new Scanner(System.in);\n        System.out.println("Hello from Java!");\n        System.out.print("Enter name: ");\n        String name = scanner.nextLine();\n        System.out.println("Welcome, " + name + "!");\n    }\n}', 'Diana');
    
    await testCode('javascript', 'console.log("Hello from JavaScript!");\nconst readline = require("readline");\nconst rl = readline.createInterface({\n  input: process.stdin,\n  output: process.stdout\n});\nrl.on("line", (input) => {\n  console.log(`Welcome, ${input}!`);\n  rl.close();\n});', 'Eve');
    
    await testCode('typescript', 'console.log("Hello from TypeScript!");\nconst name: string = "Frank";\nconsole.log(`Welcome, ${name}!`);');
    
    await testCode('sql', 'CREATE TABLE users (id INTEGER, name TEXT);\nINSERT INTO users VALUES (1, "Alice");\nINSERT INTO users VALUES (2, "Bob");\nSELECT * FROM users;');
    
    console.log('\n🎉 All tests completed!');
    
  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Make sure the server is running on http://localhost:3000');
    }
  }
};

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}

export { testCode, runTests };
