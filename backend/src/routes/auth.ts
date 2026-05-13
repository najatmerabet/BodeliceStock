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
        res.json({ token });
    } catch (error) {
        res.status(500).json({ message: 'Erreur serveur' });
    }
})
export default router;