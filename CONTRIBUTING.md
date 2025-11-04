# 🤝 Contributing to Bingo Vault

Thank you for your interest in contributing to Bingo Vault! This document provides guidelines and instructions for contributing.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Submitting Changes](#submitting-changes)
- [Reporting Bugs](#reporting-bugs)
- [Feature Requests](#feature-requests)

## 📜 Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on what is best for the community
- Show empathy towards other community members

## 🚀 Getting Started

### 1. Fork the Repository

```bash
# Click "Fork" on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/bingo-vault.git
cd bingo-vault
```

### 2. Set Up Development Environment

```bash
# Install dependencies
npm install
cd dashboard && npm install && cd ..

# Copy environment variables
cp .env.example .env
# Edit .env with your credentials

# Run setup wizard
node scripts/setup.js

# Test connection
node scripts/test-connection.js
```

### 3. Create a Branch

```bash
# Create a feature branch
git checkout -b feature/your-feature-name

# Or a bugfix branch
git checkout -b fix/bug-description
```

## 💻 Development Workflow

### Running Locally

```bash
# Terminal 1: Run the bot
npm run bot

# Terminal 2: Run the dashboard
npm run dev
```

### Testing Your Changes

1. **Test Bot Commands:**
   - Send messages to your bot
   - Verify all commands work
   - Check error handling

2. **Test Dashboard:**
   - Login and navigate all pages
   - Test payment approval
   - Test game management

3. **Test Database:**
   - Verify data is saved correctly
   - Check for data integrity
   - Test edge cases

### Making Changes

**Bot Changes:**
- Commands: `bot/commands/`
- Services: `bot/services/`
- Utilities: `bot/utils/`

**Dashboard Changes:**
- Pages: `dashboard/pages/`
- Components: `dashboard/components/`
- Styles: `dashboard/styles/`

**Database Changes:**
- Schema: `supabase/schema.sql`
- Document migrations in comments

## 📝 Coding Standards

### JavaScript Style

```javascript
// Use ES6+ features
import { something } from 'module';

// Use async/await
async function fetchData() {
  try {
    const data = await supabase.from('table').select();
    return data;
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Use descriptive variable names
const userBalance = 100; // Good
const ub = 100; // Bad

// Add comments for complex logic
// Calculate prize pool distribution
const winnerShare = prizePool * 0.9;
const platformFee = prizePool * 0.1;
```

### File Organization

```javascript
// 1. Imports
import { Telegraf } from 'telegraf';
import { supabase } from './utils/supabaseClient.js';

// 2. Constants
const GAME_ENTRY_FEE = 10;

// 3. Helper functions
function calculatePrize(pool) {
  return pool * 0.9;
}

// 4. Main functions
export async function handlePlay(ctx) {
  // Implementation
}

// 5. Exports (if not inline)
export { handlePlay };
```

### Error Handling

```javascript
// Always handle errors
try {
  const result = await riskyOperation();
  return { success: true, data: result };
} catch (error) {
  console.error('Operation failed:', error);
  return { success: false, error: error.message };
}

// Provide user-friendly messages
if (!user) {
  return ctx.reply('❌ You need to register first. Use /start');
}
```

### React/Next.js Style

```javascript
// Use functional components
export default function Component({ prop }) {
  const [state, setState] = useState(initialValue);
  
  useEffect(() => {
    // Side effects
  }, [dependencies]);
  
  return (
    <div className="container">
      {/* JSX */}
    </div>
  );
}

// Use Tailwind classes
<button className="btn btn-primary">
  Click Me
</button>
```

## 🔍 Code Review Checklist

Before submitting, ensure:

- [ ] Code follows project style
- [ ] All functions have error handling
- [ ] User-facing messages are clear
- [ ] No console.log in production code (use proper logging)
- [ ] No hardcoded credentials
- [ ] Comments explain complex logic
- [ ] Variable names are descriptive
- [ ] Code is DRY (Don't Repeat Yourself)
- [ ] Edge cases are handled
- [ ] Database queries are optimized

## 📤 Submitting Changes

### 1. Commit Your Changes

```bash
# Stage changes
git add .

# Commit with descriptive message
git commit -m "Add feature: user profile page"

# Use conventional commits
# feat: New feature
# fix: Bug fix
# docs: Documentation
# style: Formatting
# refactor: Code restructuring
# test: Adding tests
# chore: Maintenance
```

### 2. Push to Your Fork

```bash
git push origin feature/your-feature-name
```

### 3. Create Pull Request

1. Go to your fork on GitHub
2. Click "Pull Request"
3. Select your branch
4. Fill in the template:

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Performance improvement

## Testing
- [ ] Tested locally
- [ ] All commands work
- [ ] Dashboard functions correctly
- [ ] No errors in console

## Screenshots (if applicable)
Add screenshots here

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-reviewed code
- [ ] Commented complex code
- [ ] Updated documentation
- [ ] No breaking changes
```

4. Submit the PR

## 🐛 Reporting Bugs

### Before Reporting

1. Check existing issues
2. Test on latest version
3. Gather error messages
4. Note steps to reproduce

### Bug Report Template

```markdown
## Bug Description
Clear description of the bug

## Steps to Reproduce
1. Go to '...'
2. Click on '...'
3. See error

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Screenshots
If applicable

## Environment
- OS: [e.g., Windows 10]
- Node version: [e.g., 18.0.0]
- Bot version: [e.g., 1.0.0]

## Additional Context
Any other information
```

## 💡 Feature Requests

### Feature Request Template

```markdown
## Feature Description
Clear description of the feature

## Problem It Solves
What problem does this solve?

## Proposed Solution
How should it work?

## Alternatives Considered
Other solutions you've thought about

## Additional Context
Mockups, examples, etc.
```

## 🎯 Priority Areas

We especially welcome contributions in:

1. **Testing:**
   - Unit tests
   - Integration tests
   - End-to-end tests

2. **Documentation:**
   - Improve README
   - Add code comments
   - Create tutorials

3. **Features:**
   - Multi-language support
   - Tournament mode
   - Leaderboards
   - Statistics dashboard

4. **Performance:**
   - Optimize database queries
   - Reduce API calls
   - Improve load times

5. **Security:**
   - Input validation
   - Rate limiting
   - Security audits

## 🏆 Recognition

Contributors will be:
- Listed in README.md
- Mentioned in release notes
- Given credit in documentation

## 📞 Getting Help

- **Questions:** Open a discussion on GitHub
- **Issues:** Create an issue
- **Chat:** Join our community (if available)

## 📚 Resources

- [Telegraf Documentation](https://telegraf.js.org/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)

## 🙏 Thank You

Every contribution, no matter how small, is valuable. Thank you for helping make Bingo Vault better!

---

**Happy Coding! 🎮**
