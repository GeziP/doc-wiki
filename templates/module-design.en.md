# DeepWiki Document Template

This template defines the chapter structure for DeepWiki technical documentation.

---

## Template Placeholders

| Placeholder | Description |
|-------------|-------------|
| `{{MODULE_NAME}}` | Module name (e.g., Task, Module) |
| `{{FILE_PATH}}` | Source file path |
| `{{VERSION}}` | Document version |
| `{{DATE}}` | Current date |
| `{{RELATED_DOCS}}` | Related document list |
| `{{TEST_FILE}}` | Test file path |

---

# {{MODULE_NAME}} Technical Design Document

## Document Information

| Item | Content |
|------|---------|
| Document Version | {{VERSION}} |
| Written Date | {{DATE}} |
| Target Audience | Software Engineers, System Architects |
| Related Docs | {{RELATED_DOCS}} |
| Implementation File | {{FILE_PATH}} |
| Test File | {{TEST_FILE}} |

---

## Table of Contents

- [1. Overview](#1-overview)
- [2. Design Goals](#2-design-goals)
- [3. Architecture](#3-architecture)
- [4. Core Concepts](#4-core-concepts)
- [5. State Machine](#5-state-machine)
- [6. Flow Diagram](#6-flow-diagram)
- [7. Implementation](#7-implementation)
- [8. API Reference](#8-api-reference)
- [9. Usage Guide](#9-usage-guide)
- [10. FAQ](#10-faq)
- [11. Test Coverage](#11-test-coverage)

---

## 1. Overview

### 1.1 Background

[Describe the context for this module, why it's needed]

### 1.2 Problem

[Describe the specific problems this module solves]

| Problem | Impact |
|---------|--------|
| [Problem1] | [Impact1] |
| [Problem2] | [Impact2] |

### 1.3 Solution

[Describe the solution, including ASCII architecture diagram]

```
┌─────────────────────────────────────────────────────────────┐
│                    {{MODULE_NAME}} Architecture              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Component diagram]                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Design Goals

### 2.1 Functional Goals

| Goal | Description |
|------|-------------|
| [Goal1] | [Description1] |
| [Goal2] | [Description2] |

### 2.2 Non-Functional Goals

| Goal | Metric |
|------|--------|
| Performance | [Performance requirement] |
| Memory | [Memory requirement] |
| Dependencies | [Dependency requirement] |

---

## 3. Architecture

### 3.1 Module Relationships

```
[Module dependency diagram / call relationship diagram]
```

### 3.2 Responsibility Division

| Layer/Component | Responsibility |
|-----------------|----------------|
| [ComponentA] | [ResponsibilityA] |
| [ComponentB] | [ResponsibilityB] |

---

## 4. Core Concepts

### 4.1 Data Structures

[Core data structure definitions]

```cpp
struct [StructName] {
    [Field descriptions]
};
```

### 4.2 Enum Definitions

| Value | Name | Meaning |
|-------|------|---------|
| 0 | [Name0] | [Meaning0] |
| 1 | [Name1] | [Meaning1] |

### 4.3 Constant Definitions

| Constant | Value | Description |
|----------|-------|-------------|
| [CONSTANT] | [value] | [Description] |

---

## 5. State Machine

> **Applicable when**: Module has clear lifecycle states (e.g., Task with Pending/Running/Completed)

### 5.1 State Definitions

| State | Name | Meaning |
|-------|------|---------|
| `STATE_A` | [NameA] | [Meaning description] |
| `STATE_B` | [NameB] | [Meaning description] |
| `STATE_C` | [NameC] | [Meaning description] |

### 5.2 State Transition Diagram

```
                    ┌─────────────┐
                    │   Initial   │
                    └─────────────┘
                          │
                    start()
                          │
                          ▼
┌─────────────┐     ┌─────────────┐
│   Failed    │◀────│   Running   │
└─────────────┘ fail└─────────────┘
      ▲                     │
      │               succeed
      │                     │
      │                     ▼
      │              ┌─────────────┐
      └──────────────│  Completed  │
        reset()      └─────────────┘
```

### 5.3 Transition Conditions

| Current State | Event/Condition | Target State | Side Effect |
|---------------|-----------------|--------------|-------------|
| Initial | start() | Running | Start timing |
| Running | succeed | Completed | Callback onSuccess |
| Running | fail | Failed | Callback onFailure |
| Failed | reset() | Initial | Cleanup resources |
| Completed | reset() | Initial | Cleanup resources |

### 5.4 State Assertions

```cpp
// Valid transition check
bool canTransition(State from, State to) const {
    static const std::set<std::pair<State, State>> valid = {
        {Initial, Running},
        {Running, Completed},
        {Running, Failed},
        {Failed, Initial},
        {Completed, Initial}
    };
    return valid.count({from, to}) > 0;
}
```

---

## 6. Flow Diagram

> **Applicable when**: Module has complex core workflows (e.g., task scheduling, signal parsing)

### 6.1 [Core Process Name]

```
┌─────────────────────────────────────────────────────────────┐
│                    [Process Name] Flow Diagram               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐                                               │
│  │  Start  │                                               │
│  └────┬────┘                                               │
│       │                                                     │
│       ▼                                                     │
│  ┌─────────┐     ┌─────────┐                              │
│  │ Step 1  │────▶│ Step 2  │                              │
│  └─────────┘     └────┬────┘                              │
│                       │                                     │
│                       ▼                                     │
│                 ┌─────────┐                                │
│            Yes  │ Condition│  No                           │
│            ┌────│  Check?  │────┐                          │
│            │    └─────────┘    │                          │
│            ▼                   ▼                          │
│       ┌─────────┐        ┌─────────┐                     │
│       │ Step 3A │        │ Step 3B │                     │
│       └────┬────┘        └────┬────┘                     │
│            │                  │                           │
│            └────────┬─────────┘                          │
│                     ▼                                      │
│              ┌─────────┐                                  │
│              │   End   │                                  │
│              └─────────┘                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Process Step Description

| Step | Operation | Description |
|------|-----------|-------------|
| Step 1 | [Operation description] | [Detailed description] |
| Step 2 | [Operation description] | [Detailed description] |
| Step 3A | [Operation description] | When condition is Yes |
| Step 3B | [Operation description] | When condition is No |

### 6.3 Exception Handling Flow

```
[Exception handling flow diagram, such as error recovery, retry logic, etc.]
```

---

## 7. Implementation

### 7.1 [Core Method 1]

```cpp
[Code snippet with comments]
```

### 7.2 [Core Method 2]

```cpp
[Code snippet with comments]
```

---

## 8. API Reference

### 8.1 Public Interfaces

| Function | Signature | Description |
|----------|-----------|-------------|
| [Function1] | `[Signature]` | [Description] |
| [Function2] | `[Signature]` | [Description] |

### 8.2 Configuration Options

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| [Param1] | [Type] | [Default] | [Description] |

---

## 9. Usage Guide

### 9.1 Basic Usage

```cpp
// ========== Basic Usage Example ==========

[Complete runnable code]
```

### 9.2 Advanced Usage

```cpp
// ========== Advanced Usage Example ==========

[With callbacks/configuration/error handling]
```

### 9.3 Best Practices

- [Best practice 1]
- [Best practice 2]

---

## 10. FAQ

### FAQ

| Question | Answer |
|----------|--------|
| [Q1] | [A1] |
| [Q2] | [A2] |

### Common Pitfalls

- [Pitfall1]: [Cause + Solution]
- [Pitfall2]: [Cause + Solution]

---

## 11. Test Coverage

### 11.1 Test Cases

| Test | Description |
|------|-------------|
| [Test1] | [Description] |
| [Test2] | [Description] |

### 11.2 Test Statistics

| Item | Value |
|------|-------|
| Total Tests | [N] |
| Passed | [N] |
| Coverage Scope | [Scope description] |

---

## Appendix: File List

| File | Description |
|------|-------------|
| {{FILE_PATH}} | Module implementation |
| {{TEST_FILE}} | Unit tests |

---

## Appendix: Dependencies

```
{{MODULE_NAME}}
    ├── [Dependency module 1]
    ├── [Dependency module 2]
    └── [Dependency module 3]
```

---

## Appendix: Change History

| Version | Date | Changes |
|---------|------|---------|
| V1.0 | {{DATE}} | Initial version |