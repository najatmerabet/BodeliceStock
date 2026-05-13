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
const accessToken = Jwt.sign(
  { userId: user.id },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const refreshToken = Jwt.sign(
  { userId: user.id },
  JWT_SECRET,
  { expiresIn: '7d' }
);

res.json({ 
  accessToken,
  refreshToken,
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

router.post('/refresh', (req, res) => {
     console.log("🔥 REFRESH CALLED");
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({ message: 'Refresh token manquant' });
  }

  try {
    const decoded = Jwt.verify(refreshToken, JWT_SECRET) as { userId: number };

    const newAccessToken = Jwt.sign(
      { userId: decoded.userId },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({ accessToken: newAccessToken });

  } catch (err) {
    return res.status(403).json({ message: 'Refresh token invalide' });
  }
});

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