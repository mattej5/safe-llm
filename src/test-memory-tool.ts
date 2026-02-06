
import { saveMemoryTool, readMemoryTool, deleteMemoryTool } from './tools';

async function testMemoryTools() {
    console.log('🧪 Testing Memory Tools...');

    const testMemory = `Test Memory ${Date.now()}`;

    // 1. Save Memory
    console.log(`\n1. Saving memory: "${testMemory}"`);
    // @ts-ignore
    const saveResult = await saveMemoryTool.execute({ memory: testMemory });
    console.log('   Save Result:', saveResult);

    // 2. Read Memory
    console.log('\n2. Reading memories...');
    // @ts-ignore
    const readResult1 = await readMemoryTool.execute({});
    // @ts-ignore
    if (readResult1.memories.includes(testMemory)) {
        console.log('   ✅ Memory found in storage.');
    } else {
        console.error('   ❌ Memory NOT found in storage!');
        process.exit(1);
    }

    // 3. Delete Memory
    console.log(`\n3. Deleting memory: "${testMemory}"`);
    // @ts-ignore
    const deleteResult = await deleteMemoryTool.execute({ memory: testMemory });
    console.log('   Delete Result:', deleteResult);

    // 4. Verify Deletion
    console.log('\n4. Verifying deletion...');
    // @ts-ignore
    const readResult2 = await readMemoryTool.execute({});
    // @ts-ignore
    if (!readResult2.memories.includes(testMemory)) {
        console.log('   ✅ Memory successfully deleted.');
    } else {
        console.error('   ❌ Memory STILL present in storage!');
        process.exit(1);
    }

    console.log('\n✅ All tests passed!');
}

testMemoryTools().catch(console.error);
