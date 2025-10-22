LM ACCESSORIES - Render-ready package
====================================

This package is prepared to upload directly to Render (Upload a .zip -> Web Service).
Root package.json runs 'postinstall' to build the frontend and 'start' to run the backend server.

Steps to deploy on Render (quick):
1. Login to Render (your account is ready).
2. Dashboard -> New + -> Web Service -> Upload a .zip file.
3. Upload this ZIP and create the service. Use defaults. Start command: node backend/index.js
4. (Optional) Add STRIPE_SECRET in Render's Environment if you want payments.

Admin login: LMACCESSORIES / Lney563901