# Email DNS records for alfathresidence.com

These restore Microsoft 365 email (info@alfathresidence.com) after the nameserver move
to Netlify DNS. Copied exactly from GoDaddy's original zone.

Add them in: **Netlify → Domains → alfathresidence.com → DNS records → Add new record**

---

## Essential — email will not work without these

### 1. MX record
| Field | Value |
|---|---|
| Type | `MX` |
| Name | *(leave empty — this means the domain itself)* |
| Value / Server | `alfathresidence-com.mail.protection.outlook.com` |
| Priority | `0` |
| TTL | leave default |

### 2. TXT record — SPF (stops your mail being marked as spam)
| Field | Value |
|---|---|
| Type | `TXT` |
| Name | *(leave empty)* |
| Value | `v=spf1 include:secureserver.net -all` |

### 3. TXT record — Microsoft 365 domain verification
| Field | Value |
|---|---|
| Type | `TXT` |
| Name | *(leave empty)* |
| Value | `NETORGFT21104068.onmicrosoft.com` |

### 4. CNAME — Outlook autodiscover (lets Outlook apps find the mailbox)
| Field | Value |
|---|---|
| Type | `CNAME` |
| Name | `autodiscover` |
| Value | `autodiscover.outlook.com` |

---

## Optional — only for Microsoft Teams / Skype for Business

Skip these unless you use Teams with this domain. Email works fine without them.

| Type | Name | Value | Extra |
|---|---|---|---|
| CNAME | `sip` | `sipdir.online.lync.com` | |
| CNAME | `lyncdiscover` | `webdir.online.lync.com` | |
| CNAME | `msoid` | `clientconfig.microsoftonline-p.net` | |
| CNAME | `email` | `email.secureserver.net` | GoDaddy webmail shortcut |
| SRV | `_sip._tls` | `sipdir.online.lync.com` | port 443, priority 100, weight 1 |
| SRV | `_sipfederationtls._tcp` | `sipfed.online.lync.com` | port 5061, priority 100, weight 1 |

---

## After adding them

1. Wait 10–30 minutes for DNS to spread
2. Send a test email from your phone to `info@alfathresidence.com`
3. Once it arrives, redo the Web3Forms verification — that email will now get through

## To check whether it worked

Run this and look for the outlook.com line:

```bash
nslookup -type=MX alfathresidence.com 8.8.8.8
```
