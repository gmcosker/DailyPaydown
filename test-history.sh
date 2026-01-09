#!/bin/bash

# Script to create mock history for testing
# This will log in and then call the test history endpoint

BASE_URL="http://192.168.1.139:4000"
EMAIL="garritymcosker@gmail.com"
PASSWORD="your-password-here"  # You'll need to replace this with your actual password

echo "Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to login. Check your credentials."
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "✓ Logged in successfully"
echo "Creating mock history..."

HISTORY_RESPONSE=$(curl -s -X POST "$BASE_URL/today/test/history" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN")

echo "Response:"
echo "$HISTORY_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$HISTORY_RESPONSE"
echo ""
echo "✓ Done! Check your History screen in the app."


