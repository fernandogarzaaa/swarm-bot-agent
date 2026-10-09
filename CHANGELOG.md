# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added / Changed
- Fixed: runCommand no longer crashes with an unhandled "spawn gh ENOENT" when the gh CLI (or any executable) is missing; it returns exit code 127 with a "command not found" message
- Dependabot config for npm and GitHub Actions (weekly)
- .env.example listing environment variables the code reads
- SECURITY.md with private reporting contact
