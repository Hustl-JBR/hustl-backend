# Converting to CommonJS

All route and service files need to be converted from ES6 modules to CommonJS to match your existing server.js.

## Pattern:

**FROM (ES6):**
```javascript
import express from 'express';
import prisma from '../db.js';
export default router;
```

**TO (CommonJS):**
```javascript
const express = require('express');
const prisma = require('../db');
module.exports = router;
```

## Files to convert:
- All files in `routes/` folder
- All files in `services/` folder  
- `db.js` → `db.js` (already CommonJS compatible)
- `middleware/auth.js` → `middleware/auth.js`

