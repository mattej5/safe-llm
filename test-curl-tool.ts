
import { safeCurlTool } from './src/tools';

async function runTests() {
    console.log("Starting Safe Curl Tool Tests...\n");

    const tests = [
        {
            name: "1. Public URL (Google)",
            input: { url: "https://www.google.com" },
            mockDocker: false,
            expected: (res: any) => res.status === 200 && res.body.length > 0
        },
        {
            name: "2. Localhost (No Docker) - Should Fail",
            input: { url: "http://localhost:3000" },
            mockDocker: false,
            expected: (res: any) => res.error && res.error.includes("loopback")
        },
        {
            name: "3. Localhost (With Docker) - Should Rewrite",
            input: { url: "http://localhost:3000" },
            mockDocker: true,
            // Since we can't actually reach host.docker.internal in this node script environment easily without mapping,
            // we expect it to try to resolve 'host.docker.internal' and likely fail resolution or connection,
            // BUT NOT fail with the "loopback" security error.
            expected: (res: any) => {
                // If it returns a security error, test failed.
                if (res.error && res.error.includes("loopback")) return false;
                // It might fail to resolve/fetch, that's fine for this environment.
                // We want to verify it didn't block it as a private IP.
                return true;
            }
        },
        {
            name: "4. Private IP (192.168.1.1) - Should Fail",
            input: { url: "http://192.168.1.1" },
            mockDocker: false,
            expected: (res: any) => res.error && res.error.includes("private network")
        },
        {
            name: "5. Invalid Protocol (ftp) - Should Fail",
            input: { url: "ftp://example.com" },
            mockDocker: false,
            expected: (res: any) => res.error && res.error.includes("Invalid protocol")
        }
    ];

    for (const test of tests) {
        process.env.RUNNING_IN_DOCKER = test.mockDocker ? 'true' : 'false';
        console.log(`Running: ${test.name}`);
        const result = await safeCurlTool.execute(test.input);

        // Clean up result for display
        const displayResult = { ...result };
        if (displayResult.body) displayResult.body = displayResult.body.substring(0, 100) + "...";

        console.log("Result:", JSON.stringify(displayResult));

        if (test.expected(result)) {
            console.log("✅ PASSED\n");
        } else {
            console.log("❌ FAILED\n");
            console.log("Full Result:", result);
        }
    }
}

runTests();
