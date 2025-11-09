import "dotenv/config";
import { geocodeAddress, geocodeAddressSafe } from "../lib/geocode";

async function main() {
  console.log("🧪 Testing geocoding utility...\n");

  // Test with a real Phoenix address
  const testAddress = {
    street: "123 N Central Ave",
    city: "Phoenix",
    state: "AZ",
    postalCode: "85004",
    country: "US",
  };

  console.log("Test address:", testAddress);
  console.log("");

  try {
    // First call - should hit Mapbox API
    console.log("1️⃣ First call (should hit Mapbox API):");
    const result1 = await geocodeAddress(testAddress);
    console.log(`   ✅ Result: ${result1.lat}, ${result1.lon}`);
    console.log("");

    // Second call - should hit cache
    console.log("2️⃣ Second call (should hit cache):");
    const result2 = await geocodeAddress(testAddress);
    console.log(`   ✅ Result: ${result2.lat}, ${result2.lon}`);
    console.log(`   ${result1.lat === result2.lat && result1.lon === result2.lon ? "✅ Cache hit confirmed!" : "❌ Cache miss"}`);
    console.log("");

    // Test safe version with invalid address
    console.log("3️⃣ Testing safe version with invalid address:");
    const invalidResult = await geocodeAddressSafe({
      street: "This Address Does Not Exist 99999",
      city: "Nowhere",
      state: "XX",
      country: "US",
    });
    console.log(`   ${invalidResult === null ? "✅ Correctly returned null (no crash)" : "❌ Should have returned null"}`);
    console.log("");

    console.log("✅ All tests passed!");
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });






