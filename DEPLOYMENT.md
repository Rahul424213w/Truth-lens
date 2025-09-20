# TruthLens Deployment Guide

This guide covers various deployment options for the TruthLens application.

## Prerequisites

- Google AI API key
- MongoDB database (local or cloud)
- Domain name (optional)

## Environment Variables

Create a `.env` file based on `env.example`:

```bash
cp env.example .env
```

Required environment variables:
- `GOOGLE_API_KEY`: Your Google AI API key
- `MONGO_URL`: MongoDB connection string
- `JWT_SECRET`: Secret key for JWT tokens
- `REACT_APP_BACKEND_URL`: Backend API URL

## Deployment Options

### 1. Docker Deployment

#### Using Docker Compose (Recommended)

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd truthlens
   ```

2. Set up environment variables:
   ```bash
   cp env.example .env
   # Edit .env with your values
   ```

3. Start the services:
   ```bash
   docker-compose up -d
   ```

4. Access the application:
   - Frontend: http://localhost:3000
   - Backend: http://localhost:8001

#### Using Docker

1. Build the backend image:
   ```bash
   docker build -t truthlens-backend .
   ```

2. Run the backend:
   ```bash
   docker run -p 8001:8001 \
     -e GOOGLE_API_KEY=your-key \
     -e MONGO_URL=your-mongodb-url \
     -e JWT_SECRET=your-secret \
     truthlens-backend
   ```

3. Build and run the frontend:
   ```bash
   cd frontend
   docker build -t truthlens-frontend .
   docker run -p 3000:3000 truthlens-frontend
   ```

### 2. Railway Deployment

1. Install Railway CLI:
   ```bash
   npm install -g @railway/cli
   ```

2. Login to Railway:
   ```bash
   railway login
   ```

3. Deploy the backend:
   ```bash
   railway deploy
   ```

4. Set environment variables in Railway dashboard:
   - `GOOGLE_API_KEY`
   - `MONGO_URL`
   - `JWT_SECRET`

### 3. Heroku Deployment

#### Backend Deployment

1. Install Heroku CLI
2. Create a Heroku app:
   ```bash
   heroku create your-app-name
   ```

3. Add MongoDB addon:
   ```bash
   heroku addons:create mongolab:sandbox
   ```

4. Set environment variables:
   ```bash
   heroku config:set GOOGLE_API_KEY=your-key
   heroku config:set JWT_SECRET=your-secret
   ```

5. Deploy:
   ```bash
   git push heroku main
   ```

#### Frontend Deployment

1. Build the frontend:
   ```bash
   cd frontend
   npm run build
   ```

2. Deploy to Vercel:
   ```bash
   npx vercel --prod
   ```

### 4. VPS Deployment

#### Using Nginx and PM2

1. Set up the server (Ubuntu/Debian):
   ```bash
   sudo apt update
   sudo apt install nginx nodejs npm python3 python3-pip
   ```

2. Clone and set up the backend:
   ```bash
   git clone <your-repo-url>
   cd truthlens/backend
   pip3 install -r requirements.txt
   ```

3. Set up environment variables:
   ```bash
   cp ../env.example .env
   # Edit .env with your values
   ```

4. Install PM2:
   ```bash
   npm install -g pm2
   ```

5. Start the backend with PM2:
   ```bash
   pm2 start server.py --name truthlens-backend
   pm2 save
   pm2 startup
   ```

6. Set up Nginx:
   ```bash
   sudo nano /etc/nginx/sites-available/truthlens
   ```

   Add the following configuration:
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://localhost:8001;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

7. Enable the site:
   ```bash
   sudo ln -s /etc/nginx/sites-available/truthlens /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

8. Set up SSL with Let's Encrypt:
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

## Database Setup

### MongoDB Atlas (Recommended)

1. Create a MongoDB Atlas account
2. Create a new cluster
3. Get the connection string
4. Set `MONGO_URL` environment variable

### Local MongoDB

1. Install MongoDB:
   ```bash
   # Ubuntu/Debian
   sudo apt install mongodb

   # macOS
   brew install mongodb-community
   ```

2. Start MongoDB:
   ```bash
   sudo systemctl start mongodb
   ```

3. Set `MONGO_URL=mongodb://localhost:27017/truthlens_db`

## Monitoring and Maintenance

### Health Checks

The application includes health check endpoints:
- Backend: `GET /api/health`
- Frontend: Built-in React error boundaries

### Logging

- Backend logs are available in the console
- Use PM2 logs for production: `pm2 logs truthlens-backend`

### Updates

1. Pull the latest changes:
   ```bash
   git pull origin main
   ```

2. Restart services:
   ```bash
   # Docker Compose
   docker-compose down && docker-compose up -d

   # PM2
   pm2 restart truthlens-backend
   ```

## Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure `CORS_ORIGINS` includes your frontend URL
2. **Database Connection**: Verify `MONGO_URL` is correct
3. **API Key Issues**: Check `GOOGLE_API_KEY` is valid
4. **Port Conflicts**: Ensure ports 3000 and 8001 are available

### Debug Mode

Enable debug mode by setting:
```bash
export DEBUG=true
```

## Security Considerations

1. Use strong JWT secrets
2. Enable HTTPS in production
3. Set up proper CORS origins
4. Use environment variables for sensitive data
5. Regularly update dependencies
6. Monitor for security vulnerabilities

## Performance Optimization

1. Enable gzip compression
2. Use CDN for static assets
3. Implement caching strategies
4. Monitor database performance
5. Use connection pooling for MongoDB
