const Configurations = {
    extends: ['@commitlint/cli', '@commitlint/config-conventional'],
    rules:{
        "type-enum": [2, "always", [
            "build", "chore", "ci", "docs", "feat", "fix", "perf", "refactor", "revert", "style", "test"
        ]],
        "subject-case": [2, "always", "sentence-case"]
    }
}

export default Configurations;