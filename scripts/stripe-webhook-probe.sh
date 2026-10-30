#!/bin/bash
# Drives the Stripe webhook probe: signs events the way Stripe does (t=…,v1=HMAC-SHA256 over
# "t.body") and posts them at a server started with
#   bun --preload ./scripts/stripe-webhook-http-probe.preload.ts serve.ts
# Every case is a status code plus body; case 7 shows what the handler actually wrote.
#
#   BASE=http://127.0.0.1:3111 SECRET=whsec_probe_only_do_not_use bash scripts/stripe-webhook-probe.sh
set -u
SECRET="${SECRET:-whsec_probe_only_do_not_use}"
BASE="${BASE:-http://127.0.0.1:3111}"
URL="$BASE/api/stripe/webhook"
SIDECAR="${SIDECAR:-http://127.0.0.1:3112}"
BODY='{"id":"evt_probe_001","object":"event","type":"customer.subscription.updated","data":{"object":{"id":"sub_probe_nonexistent","object":"subscription","status":"active","current_period_start":1700000000,"current_period_end":1702600000,"cancel_at_period_end":false}}}'
printf '%s' "$BODY" > /tmp/evt.json

sign() { python3 -c "
import hmac,hashlib,time,sys
secret='$SECRET'; body=open('/tmp/evt.json','rb').read().decode()
t=str(int(time.time()))
print(t+','+hmac.new(secret.encode(),(t+'.'+body).encode(),hashlib.sha256).hexdigest())
"; }

echo "### 1) VALID signature"
SIG=$(sign); TS=${SIG%,*}; V1=${SIG#*,}
curl -s -o /tmp/r1.body -w "HTTP %{http_code}\n" -X POST "$URL" \
  -H "Content-Type: application/json" -H "stripe-signature: t=$TS,v1=$V1" \
  --data-binary @/tmp/evt.json
echo "body: $(cat /tmp/r1.body)"

echo
echo "### 2) SAME EVENT REPLAYED (same id, fresh timestamp+signature)"
SIG2=$(sign); TS2=${SIG2%,*}; V12=${SIG2#*,}
curl -s -o /tmp/r2.body -w "HTTP %{http_code}\n" -X POST "$URL" \
  -H "Content-Type: application/json" -H "stripe-signature: t=$TS2,v1=$V12" \
  --data-binary @/tmp/evt.json
echo "body: $(cat /tmp/r2.body)"

echo
echo "### 3) TAMPERED signature (last hex char flipped)"
BAD="${V1%?}$( [ "${V1: -1}" = "0" ] && echo 1 || echo 0 )"
curl -s -o /tmp/r3.body -w "HTTP %{http_code}\n" -X POST "$URL" \
  -H "Content-Type: application/json" -H "stripe-signature: t=$TS,v1=$BAD" \
  --data-binary @/tmp/evt.json
echo "body: $(cat /tmp/r3.body)"

echo
echo "### 4) NO signature header at all"
curl -s -o /tmp/r4.body -w "HTTP %{http_code}\n" -X POST "$URL" \
  -H "Content-Type: application/json" --data-binary @/tmp/evt.json
echo "body: $(cat /tmp/r4.body)"

echo
echo "### 5) VALID signature but body tampered after signing (one byte changed)"
curl -s -o /tmp/r5.body -w "HTTP %{http_code}\n" -X POST "$URL" \
  -H "Content-Type: application/json" -H "stripe-signature: t=$TS,v1=$V1" \
  --data-binary "${BODY/active/activo}"
echo "body: $(cat /tmp/r5.body)"

echo
echo "### 6) VALID signature, no event id (must be 400, never 500)"
printf '%s' '{"type":"customer.subscription.updated","data":{"object":{"id":"sub_x"}}}' > /tmp/evt2.json
SIG3=$(python3 -c "
import hmac,hashlib,time
secret='$SECRET'; body=open('/tmp/evt2.json','rb').read().decode()
t=str(int(time.time()))
print(t+','+hmac.new(secret.encode(),(t+'.'+body).encode(),hashlib.sha256).hexdigest())
"); TS3=${SIG3%,*}; V13=${SIG3#*,}
curl -s -o /tmp/r6.body -w "HTTP %{http_code}\n" -X POST "$URL" \
  -H "Content-Type: application/json" -H "stripe-signature: t=$TS3,v1=$V13" \
  --data-binary @/tmp/evt2.json
echo "body: $(cat /tmp/r6.body)"

echo
echo "### 7) WHAT THE HANDLER ACTUALLY WROTE (sqlite sidecar)"
curl -s "$SIDECAR/db" | python3 -m json.tool
