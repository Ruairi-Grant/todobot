import "../env";
import { getLangSmithClient } from "./client";
import { getLatestTrace, searchTraces } from "./tools";

async function main() {
  // 1. Test client instantiation
  console.log("--- Test 1: Client instantiation ---");
  try {
    const client = getLangSmithClient();
    console.log("✅ Client created successfully");
  } catch (e: any) {
    console.log("❌ Client creation failed:", e.message);
    return;
  }

  // 2. Test getLatestTrace
  console.log("\n--- Test 2: getLatestTrace ---");
  try {
    const result = await getLatestTrace();
    console.log("✅ getLatestTrace returned:", JSON.stringify(result, null, 2));
  } catch (e: any) {
    console.log("❌ getLatestTrace failed:", e.message);
  }

  // 3. Test searchTraces
  console.log("\n--- Test 3: searchTraces (last 3 runs) ---");
  try {
    const result = await searchTraces({ limit: 3 });
    if (Array.isArray(result)) {
      console.log(`✅ searchTraces returned ${result.length} runs`);
      for (const run of result) {
        console.log(`   - [${run.runType}] ${run.name} | status: ${run.status} | duration: ${run.durationMs}ms`);
      }
    } else {
      console.log("✅ searchTraces returned:", JSON.stringify(result, null, 2));
    }
  } catch (e: any) {
    console.log("❌ searchTraces failed:", e.message);
  }

  // 4. Test searchTraces with error filter
  console.log("\n--- Test 4: searchTraces (errors only) ---");
  try {
    const result = await searchTraces({ errorsOnly: true, limit: 3 });
    if (Array.isArray(result)) {
      console.log(`✅ Found ${result.length} error runs`);
      for (const run of result) {
        console.log(`   - [${run.runType}] ${run.name} | error: ${run.error}`);
      }
    } else {
      console.log("✅ searchTraces returned:", JSON.stringify(result, null, 2));
    }
  } catch (e: any) {
    console.log("❌ searchTraces (errors) failed:", e.message);
  }

  console.log("\n--- All tests complete ---");
}

main();
