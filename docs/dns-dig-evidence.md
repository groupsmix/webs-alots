# DNS Evidence — 2026-05-27 23:50 UTC

> **Audit findings:** A146-01 (HIGH), A250-02 (MEDIUM)
>
> **Current state (gaps to remediate):**
>
> - **CAA**: Not set — any CA can issue certs for `oltigo.com`. Add: `0 issue "letsencrypt.org"`, `0 issue "pki.goog"`, `0 issue "digicert.com"` via Cloudflare DNS.
> - **DNSSEC**: Not enabled — `DNSKEY` query returns `SERVFAIL`. Enable via Cloudflare Dashboard → DNS → DNSSEC, then add DS record at registrar (Namecheap).
> - **DKIM**: No `google._domainkey` record found. Add DKIM signing key if using Cloudflare Email Routing with external senders.
> - **DMARC**: Not set — add `_dmarc.oltigo.com TXT "v=DMARC1; p=reject; rua=mailto:dmarc@oltigo.com"`.
> - **SPF**: Present (`v=spf1 include:_spf.mx.cloudflare.net ~all`) — consider tightening `~all` to `-all`.
> - **MX**: Cloudflare Email Routing (3 routes) — working.
>
> **Action required:** Operator must configure CAA, DNSSEC, DKIM, and DMARC at the DNS/registrar level. Re-run `dig` evidence after remediation and update this file.

## CAA Records

```

; <<>> DiG 9.18.39-0ubuntu0.22.04.4-Ubuntu <<>> CAA oltigo.com
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 44659
;; flags: qr rd ra; QUERY: 1, ANSWER: 0, AUTHORITY: 1, ADDITIONAL: 1

;; OPT PSEUDOSECTION:
; EDNS: version: 0, flags:; udp: 65494
;; QUESTION SECTION:
;oltigo.com.			IN	CAA

;; AUTHORITY SECTION:
oltigo.com.		1800	IN	SOA	aaron.ns.cloudflare.com. dns.cloudflare.com. 2404953036 10000 2400 604800 1800

;; Query time: 7 msec
;; SERVER: 127.0.0.53#53(127.0.0.53) (UDP)
;; WHEN: Wed May 27 23:50:29 UTC 2026
;; MSG SIZE  rcvd: 99

```

## SPF (TXT)

```

; <<>> DiG 9.18.39-0ubuntu0.22.04.4-Ubuntu <<>> TXT oltigo.com
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 62430
;; flags: qr rd ra; QUERY: 1, ANSWER: 1, AUTHORITY: 0, ADDITIONAL: 1

;; OPT PSEUDOSECTION:
; EDNS: version: 0, flags:; udp: 65494
;; QUESTION SECTION:
;oltigo.com.			IN	TXT

;; ANSWER SECTION:
oltigo.com.		292	IN	TXT	"v=spf1 include:_spf.mx.cloudflare.net ~all"

;; Query time: 0 msec
;; SERVER: 127.0.0.53#53(127.0.0.53) (UDP)
;; WHEN: Wed May 27 23:50:29 UTC 2026
;; MSG SIZE  rcvd: 94

```

## DKIM (google.\_domainkey)

```

; <<>> DiG 9.18.39-0ubuntu0.22.04.4-Ubuntu <<>> TXT google._domainkey.oltigo.com
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 44108
;; flags: qr rd ra; QUERY: 1, ANSWER: 0, AUTHORITY: 1, ADDITIONAL: 1

;; OPT PSEUDOSECTION:
; EDNS: version: 0, flags:; udp: 65494
;; QUESTION SECTION:
;google._domainkey.oltigo.com.	IN	TXT

;; AUTHORITY SECTION:
oltigo.com.		1792	IN	SOA	aaron.ns.cloudflare.com. dns.cloudflare.com. 2404953036 10000 2400 604800 1800

;; Query time: 12 msec
;; SERVER: 127.0.0.53#53(127.0.0.53) (UDP)
;; WHEN: Wed May 27 23:50:29 UTC 2026
;; MSG SIZE  rcvd: 117

```

## DMARC

```

; <<>> DiG 9.18.39-0ubuntu0.22.04.4-Ubuntu <<>> TXT _dmarc.oltigo.com
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 23142
;; flags: qr rd ra; QUERY: 1, ANSWER: 0, AUTHORITY: 1, ADDITIONAL: 1

;; OPT PSEUDOSECTION:
; EDNS: version: 0, flags:; udp: 65494
;; QUESTION SECTION:
;_dmarc.oltigo.com.		IN	TXT

;; AUTHORITY SECTION:
oltigo.com.		1793	IN	SOA	aaron.ns.cloudflare.com. dns.cloudflare.com. 2404953036 10000 2400 604800 1800

;; Query time: 4 msec
;; SERVER: 127.0.0.53#53(127.0.0.53) (UDP)
;; WHEN: Wed May 27 23:50:29 UTC 2026
;; MSG SIZE  rcvd: 106

```

## MX

```

; <<>> DiG 9.18.39-0ubuntu0.22.04.4-Ubuntu <<>> MX oltigo.com
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 2204
;; flags: qr rd ra; QUERY: 1, ANSWER: 3, AUTHORITY: 0, ADDITIONAL: 1

;; OPT PSEUDOSECTION:
; EDNS: version: 0, flags:; udp: 65494
;; QUESTION SECTION:
;oltigo.com.			IN	MX

;; ANSWER SECTION:
oltigo.com.		292	IN	MX	13 route2.mx.cloudflare.net.
oltigo.com.		292	IN	MX	19 route3.mx.cloudflare.net.
oltigo.com.		292	IN	MX	25 route1.mx.cloudflare.net.

;; Query time: 4 msec
;; SERVER: 127.0.0.53#53(127.0.0.53) (UDP)
;; WHEN: Wed May 27 23:50:29 UTC 2026
;; MSG SIZE  rcvd: 125

```

## DNSSEC

```

; <<>> DiG 9.18.39-0ubuntu0.22.04.4-Ubuntu <<>> +dnssec oltigo.com DNSKEY
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: SERVFAIL, id: 59714
;; flags: qr aa rd ra; QUERY: 1, ANSWER: 0, AUTHORITY: 0, ADDITIONAL: 1

;; OPT PSEUDOSECTION:
; EDNS: version: 0, flags:; udp: 65494
;; QUESTION SECTION:
;oltigo.com.			IN	DNSKEY

;; Query time: 0 msec
;; SERVER: 127.0.0.53#53(127.0.0.53) (UDP)
;; WHEN: Wed May 27 23:50:29 UTC 2026
;; MSG SIZE  rcvd: 39

```
