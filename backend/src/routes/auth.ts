import Router from 'express';
import prisma from '../prisma';
import bcrypt from 'bcrypt';
import  Jwt  from 'jsonwebtoken';

const router =Router();

const JWT_SECRET = process.env.JWT_SECRET || 'prodmeatstocksecret2024';

router.post('/login', async (req , res)=>{
    try{
        const {email , password} = req.body;
        const user = await prisma.user.findUnique({ where: {email}});

        if(!user){
            return res.status(401).json({message: 'Email ou mot de passe incorrect'});
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if(!isMatch){
            return res.status(401).json({message: 'Email ou mot de passe incorrect'});
        }

        const token = Jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ 
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'Erreur serveur' });
    }
})

router.get('/me', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ message: 'Non autorisé' });
        }
        
        const token = authHeader.split(' ')[1];
        const decoded = Jwt.verify(token, JWT_SECRET) as { userId: number };
        
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: { id: true, email: true, name: true }
        });
        
        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }
        
        res.json(user);
    } catch (error) {
        res.status(401).json({ message: 'Token invalide' });
    }
});

export default router;