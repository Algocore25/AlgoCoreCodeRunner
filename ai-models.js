import Groq from 'groq-sdk';
import dotenv from 'dotenv';
dotenv.config();

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

/**
 * Main inference function for general tasks (summarization, etc.)
 */
export async function runAI(task, modelName, input, options = {}) {
    const model = modelName || 'llama-3.3-70b-versatile';

    let prompt = input;
    if (task === 'summarization') {
        prompt = `Summarize the following text concisely:\n\n${input}`;
    }

    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            model: model,
            temperature: options.temperature || 0.5,
            max_tokens: options.max_new_tokens || 1024,
        });

        return chatCompletion.choices[0]?.message?.content || "";
    } catch (error) {
        console.error(`❌ Groq API Error (${task}):`, error.message);
        throw error;
    }
}

/**
 * Specialized Chat/Coding Helper
 */
export async function runChat(modelName, messages, options = {}) {
    const model = modelName || 'llama-3.3-70b-versatile';

    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: messages,
            model: model,
            temperature: options.temperature || 0.7,
            max_tokens: options.max_tokens || 1024,
            top_p: 1,
            stream: false,
        });

        return chatCompletion.choices[0]?.message?.content || "";
    } catch (error) {
        console.error(`❌ Groq Chat Error:`, error.message);
        throw error;
    }
}
