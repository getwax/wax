import express from 'express';
import router from './router';

const startExpressServer = () => {
    const app = express();
    const port = 3000;
    
    app.use(router);
    
    app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });
}


export default startExpressServer;
