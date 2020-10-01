# resolve-node.vercel.app

API endpoint to resolve an arbitrary Node.js version with semver support.
Useful for shell scripting.

```
# Resolves the latest Node.js version by default
$ curl https://resolve-node.vercel.app
v13.0.1

# The special `lts` path resolves latest Long Term Support (LTS) version
$ curl https://resolve-node.vercel.app/lts
v12.13.0

# LTS version resolution by code name via `lts/:codename` is also supported
$ curl https://resolve-node.vercel.app/lts/dubnium
v10.17.0

# Semver is also supported
$ curl https://resolve-node.vercel.app/8.x
v8.16.2

# Restricting to security-only releases is also supported
$ curl https://resolve-node.vercel.app/lts/dubnium?security=true
v10.16.3
```
