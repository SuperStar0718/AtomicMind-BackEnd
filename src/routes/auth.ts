import User from "../schemas/user.model";
import bcrypt from 'bcrypt';


export const register= async (req:any) =>  { 
    const email = req.email;
    const password = req.password;
    
    const salt = await bcrypt.genSalt(10);
     // hash the password with the salt
     const hashedPassword = await bcrypt.hash(password, salt);
     const user = await User.findOne({email: email})
    if( user !== null){
        return null;
    } else{
        console.log('hashed password', hashedPassword)
        const newUser = new User({
            email,
            password: hashedPassword
        });
        return newUser.save().then((user) => {
            // console.log("user", user);
            return user.email;
        }).catch((err) => {
            console.log("err", err);
            return null;
        });
    }
 };

