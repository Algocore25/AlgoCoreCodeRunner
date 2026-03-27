import express from "express";
import cors from "cors";
import { exec } from "child_process";
import fs from "fs";
import { v4 as uuid } from "uuid";
import path from "path";

const app = express();
const PORT = process.env.FUNCTIONS_HTTPWORKER_PORT || process.env.PORT || 3000;


// Enable CORS for all origins
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: '10mb' }));

// Serve frontend dashboard correctly
app.use(express.static("public"));

// Ensure temp directory exists
const ensureTempDir = () => {
  if (!fs.existsSync('temp')) {
    fs.mkdirSync('temp', { recursive: true });
  }
};

const runCode = (language, code, input, id) => {
  // Language number mapping
  const LANGUAGE_MAP = {
    1: "c",
    2: "cpp", 
    3: "java",
    4: "python",
    5: "javascript",
    6: "typescript",
    7: "sql"
  };

  // Convert number to language string
  const languageStr = LANGUAGE_MAP[language] || language;
  
  const dir = `temp/${id}`;
  fs.mkdirSync(dir, { recursive: true });

  let file, cmd;

  try {
    switch (languageStr) {
      case "python":
        file = `${dir}/main.py`;
        fs.writeFileSync(file, code);
        if (input) {
          fs.writeFileSync(`${dir}/input.txt`, input);
          cmd = `cd ${dir} && python3 main.py < input.txt`;
        } else {
          cmd = `cd ${dir} && python3 main.py`;
        }
        break;

      case "c":
        file = `${dir}/main.c`;
        fs.writeFileSync(file, code);
        if (input) {
          fs.writeFileSync(`${dir}/input.txt`, input);
          cmd = `cd ${dir} && gcc main.c -o main && ./main < input.txt`;
        } else {
          cmd = `cd ${dir} && gcc main.c -o main && ./main`;
        }
        break;

      case "cpp":
        file = `${dir}/main.cpp`;
        fs.writeFileSync(file, code);
        if (input) {
          fs.writeFileSync(`${dir}/input.txt`, input);
          cmd = `cd ${dir} && g++ main.cpp -o main && ./main < input.txt`;
        } else {
          cmd = `cd ${dir} && g++ main.cpp -o main && ./main`;
        }
        break;

      case "java":
        file = `${dir}/Main.java`;
        fs.writeFileSync(file, code);
        if (input) {
          fs.writeFileSync(`${dir}/input.txt`, input);
          cmd = `cd ${dir} && javac Main.java && java Main < input.txt`;
        } else {
          cmd = `cd ${dir} && javac Main.java && java Main`;
        }
        break;

      case "javascript":
      case "js":
        file = `${dir}/main.js`;
        fs.writeFileSync(file, code);
        if (input) {
          fs.writeFileSync(`${dir}/input.txt`, input);
          cmd = `cd ${dir} && node main.js < input.txt`;
        } else {
          cmd = `cd ${dir} && node main.js`;
        }
        break;

      case "typescript":
      case "ts":
        file = `${dir}/main.ts`;
        fs.writeFileSync(file, code);
        if (input) {
          fs.writeFileSync(`${dir}/input.txt`, input);
          cmd = `cd ${dir} && ts-node main.ts < input.txt`;
        } else {
          cmd = `cd ${dir} && ts-node main.ts`;
        }
        break;

      case "sql":
      case "sqlite":
        file = `${dir}/main.sql`;
        // For SQL, we need to handle the input differently
        let sqlCode = `.headers on\n.mode json\n${code}`;
        if (input) {
          // If input is provided, treat it as additional SQL commands
          sqlCode = `${sqlCode}\n${input}`;
        }
        fs.writeFileSync(file, sqlCode);
        cmd = `cd ${dir} && sqlite3 main.db < main.sql`;
        break;

      default:
        throw new Error(`Unsupported language: ${language}`);
    }

    return new Promise((resolve) => {
      const startTime = Date.now();
      exec(cmd, { 
        timeout: 10000, // 10 second timeout
        cwd: process.cwd()
      }, (error, stdout, stderr) => {
        const endTime = Date.now();
        const executionTime = endTime - startTime;

        // Clean up temp directory
        try {
          if (fs.rmSync) {
            fs.rmSync(dir, { recursive: true, force: true });
          } else {
            fs.rmdirSync(dir, { recursive: true });
          }
        } catch (cleanupError) {
          console.error('Cleanup error:', cleanupError);
        }

        const errStr = stderr || (error && error.message) || "";
        const outStr = stdout || "";

        let errorMsg = null;
        if (error || errStr) {
          errorMsg = errStr.trim();
          if (errorMsg === "") errorMsg = "Unknown Error";
        }

        resolve({
          output: outStr,
          error: errorMsg,
          exitCode: error ? 1 : 0,
          cpuTime: executionTime,
          memory: 2048,
          timeout: error ? (Boolean(error.killed) || executionTime >= 10000) : false,
          signal: error ? error.signal : null,
          compileTime: ["c", "cpp", "java", "typescript", "ts"].includes(languageStr) ? 45 : null
        });
      });
    });
  } catch (error) {
    // Clean up on error
    try {
      if (fs.rmSync) {
        fs.rmSync(dir, { recursive: true, force: true });
      } else {
        fs.rmdirSync(dir, { recursive: true });
      }
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError);
    }
    throw error;
  }
};

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Get supported languages
app.get("/languages", (req, res) => {
  res.json({
    languages: [
      { name: "c", extension: "c", number: 1 },
      { name: "cpp", extension: "cpp", number: 2 },
      { name: "java", extension: "java", number: 3 },
      { name: "python", extension: "py", number: 4 },
      { name: "javascript", extension: "js", number: 5 },
      { name: "js", extension: "js", number: 5 },
      { name: "typescript", extension: "ts", number: 6 },
      { name: "ts", extension: "ts", number: 6 },
      { name: "sql", extension: "sql", number: 7 },
      { name: "sqlite", extension: "sql", number: 7 }
    ]
  });
});

// Main code execution endpoint
app.post("/run", async (req, res) => {
  try {
    ensureTempDir();
    
    const { language, sourceCode, input } = req.body;

    // Validate inputs
    if (!language) {
      return res.status(400).json({ error: "Language is required" });
    }
    
    if (!sourceCode || sourceCode.trim() === "") {
      return res.status(400).json({ error: "Source code cannot be empty" });
    }

    // Convert language number to string for logging
    const LANGUAGE_MAP = {
      1: "c",
      2: "cpp", 
      3: "java",
      4: "python",
      5: "javascript",
      6: "typescript",
      7: "sql"
    };
    
    const languageStr = LANGUAGE_MAP[language] || language;

    // Handle multiple test cases if input is an array
    if (Array.isArray(input)) {
        console.log(`🚀 Executing ${languageStr} for ${input.length} test cases...`);
        
        const results = await Promise.all(input.map(async (testInput, index) => {
            const id = uuid();
            console.log(`   - Case #${index + 1}: Running with ID: ${id}`);
            console.log(`   - Input: ${testInput}`);
            console.log(`   - Source Code: ${sourceCode}`);
            console.log(`   - Language: ${languageStr}`);
            try {
                return await runCode(language, sourceCode, testInput || "", id);
            } catch (err) {
                console.error(`Execution error for test case ${index}:`, err);
                return { 
                    output: "",
                    error: err.message,
                    exitCode: 1,
                    cpuTime: 0,
                    memory: 0,
                    timeout: false,
                    signal: null,
                    compileTime: null
                };
            }
        }));
        
        return res.json({ results });
    }

    // Single input logic (backward compatibility)
    const id = uuid();
    console.log(`🚀 Executing ${languageStr} code with ID: ${id}`);
    
    const result = await runCode(language, sourceCode, input || "", id);
    res.json(result);
  } catch (err) {
    console.error("Execution error:", err);
    res.status(500).json({ 
      output: "",
      error: err.message,
      exitCode: 1,
      cpuTime: 0,
      memory: 0,
      timeout: false,
      signal: null,
      compileTime: null
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Code Runner Server running on port ${PORT}`);
  console.log(`📝 Supported languages: C(1), C++(2), Java(3), Python(4), JavaScript(5), TypeScript(6), SQL(7)`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`🌐 CORS enabled for all origins`);
});
