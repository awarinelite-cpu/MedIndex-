# Drug Bank

A comprehensive medication database built with React, Firebase, and Tailwind CSS.

## Features

- **Public Search**: Search medications by name, condition, or drug class
- **Drug Detail Pages**: Full prescribing information, dosing, safety, interactions
- **Browse by Category**: Cardiovascular, Endocrine, Neurological, etc.
- **Admin Portal**: Manage all drugs with search, filter, and delete
- **CSV Bulk Upload**: Upload medications via CSV with real-time validation
- **Firebase Backend**: Firestore database, Authentication, Storage

## Tech Stack

- React 18 + React Router 6
- Firebase (Firestore, Auth, Storage)
- Tailwind CSS
- PapaParse (CSV parsing)
- React Dropzone (file uploads)
- Lucide React (icons)

## Quick Start

### 1. Clone & Install
```bash
cd drug-bank-app
npm install
```

### 2. Firebase Setup
1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create a new project
3. Enable Firestore Database, Authentication, and Storage
4. Get your config from Project Settings → General → Your apps
5. Copy `.env.example` to `.env` and fill in your Firebase config

### 3. Firestore Rules
Set these security rules in Firebase Console:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /drugs/{drug} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /conditions/{condition} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

### 4. Run Locally
```bash
npm start
```

### 5. Deploy to Vercel
```bash
npm install -g vercel
vercel
```

Or connect your GitHub repo to Vercel for automatic deployments.

## CSV Upload Template

Use the template from the Admin Portal or create your own with these required columns:
- `generic_name` (required)
- `drug_class` (required)
- `prescription_status` (required: OTC, Prescription, or Controlled)
- `primary_indications` (required, comma-separated)

All other 73 columns are optional. See the full template viewer for details.

## Project Structure

```
src/
  components/
    Layout.js          # App shell with nav, search, footer
  pages/
    HomePage.js        # Landing page with search, categories, featured
    DrugDetailPage.js  # Full drug profile with tabs
    BrowsePage.js      # Grid/list view with filters
    AdminPage.js       # Drug management dashboard
    UploadPage.js      # CSV upload with validation
  firebase.js          # Firebase config
  App.js               # Router setup
  index.js             # Entry point
  index.css            # Tailwind + custom styles
```
