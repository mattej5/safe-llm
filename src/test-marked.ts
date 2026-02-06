import { marked } from 'marked';
import TerminalRenderer from 'marked-terminal';
import chalk from 'chalk';

const terminalRenderer = new TerminalRenderer({
    blockquote: chalk.gray.italic,
    firstHeading: chalk.bold.underline.blue,
    heading: chalk.bold.blue,
    code: chalk.yellow,
    strong: chalk.bold.cyan,
});

// Workaround for marked v15 strict validation
// We must only pass standard renderer methods to marked.use
// AND we must wrap them to synchronize the parser state that marked injects
const renderer: any = {};
const markedRendererMethods = [
    'code', 'blockquote', 'html', 'heading', 'hr', 'list', 'listitem',
    'checkbox', 'paragraph', 'table', 'tablerow', 'tablecell',
    'strong', 'em', 'codespan', 'br', 'del', 'link', 'image', 'text'
];

markedRendererMethods.forEach(method => {
    // @ts-expect-error - dynamic access
    if (typeof terminalRenderer[method] === 'function') {
        renderer[method] = function (...args: any[]) {
            // Synchronize parser which marked v15 injects into 'this'
            if (this.parser) {
                // @ts-expect-error - dynamic assignment
                terminalRenderer.parser = this.parser;
            }
            // Custom Check for Thinking Process
            if (method === 'blockquote') {
                const text = args[0];
                if (typeof text === 'string' && text.includes('Thinking Process:')) {
                    // Apply different styling for Thinking Process
                    return chalk.blue(terminalRenderer.blockquote(text));
                }
            }

            // @ts-expect-error - dynamic call
            return terminalRenderer[method].apply(terminalRenderer, args);
        };
    }
});

marked.use({ renderer });

console.log('Testing markdown rendering:');
console.log(marked('**Bold Text**'));
console.log(marked('# Header'));
console.log(marked('> This is a blockquote'));
console.log(marked('> Thinking Process:\n> \n> This is thought content.'));
