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

// Ensure temp directory exists
const ensureTempDir = () => {
  if (!fs.existsSync('temp')) {
    fs.mkdirSync('temp', { recursive: true });
  }
};

const runCode = (language, code, input, id) => {
  const dir = `temp/${id}`;
  fs.mkdirSync(dir, { recursive: true });

  let file, cmd;

  try {
    switch (language) {
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
        let sqlCode = code;
        if (input) {
          // If input is provided, treat it as additional SQL commands
          sqlCode = `${code}\n${input}`;
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
          fs.rmSync(dir, { recursive: true, force: true });
        } catch (cleanupError) {
          console.error('Cleanup error:', cleanupError);
        }

        resolve({
          stdout: stdout || "",
          stderr: stderr || (error && error.message) || "",
          code: error ? 1 : 0,
          executionTime: executionTime,
          language: language
        });
      });
    });
  } catch (error) {
    // Clean up on error
    try {
      fs.rmSync(dir, { recursive: true, force: true });
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
      { name: "python", extension: "py" },
      { name: "c", extension: "c" },
      { name: "cpp", extension: "cpp" },
      { name: "java", extension: "java" },
      { name: "javascript", extension: "js" },
      { name: "js", extension: "js" },
      { name: "typescript", extension: "ts" },
      { name: "ts", extension: "ts" },
      { name: "sql", extension: "sql" },
      { name: "sqlite", extension: "sql" }
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

    const id = uuid();
    console.log(`Executing ${language} code with ID: ${id}`);
    
    const result = await runCode(language, sourceCode, input || "", id);
    
    res.json({ 
      run: result,
      success: result.code === 0
    });
  } catch (err) {
    console.error("Execution error:", err);
    res.status(500).json({ 
      error: err.message,
      success: false
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
  console.log(`📝 Supported languages: Python, C, C++, Java, JavaScript, TypeScript, SQLite`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`🌐 CORS enabled for all origins`);
});
