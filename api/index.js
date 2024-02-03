const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const app = express();
const port = 8000;
const cors = require("cors");
app.use(cors());

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const jwt = require("jsonwebtoken");

mongoose
  .connect(
    "mongodb+srv://anonymous00:Anonymous-17@cluster0.4hscqit.mongodb.net/",
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  )
  .then(() => {
    console.log("Connection a MongoDB");
  })
  .catch((err) => {
    console.log("Erreur lors de la connection a MongoDB", err);
  });

app.listen(port, () => {
  console.log("Serveur en cours sur le port 8000");
});

const User = require("./models/user");
const Order = require("./models/order");

const sendVerificationEmail = async (email, verificationToken) => {
  // Créer un transporteur Nodemailer
  const transporter = nodemailer.createTransport({
    // Configurez le service de messagerie ou les détails Simple Mail Transfer Protocol(SMTP) ici
    service: "gmail",
    auth: {
      user: "maneyoussouphniagabaily17@gmail.com",
      pass: "anonyMous.17",
    },
  });

  // Composez le message électronique
  const mailOptions = {
    from: "amazon.com",
    to: email,
    subject: "vérification de l'E-mail",
    text: `Veuillez cliquer sur le lien suivant pour vérifier votre email: http://localhost:8000/verify/${verificationToken}`,
  };

  // Envoyer l'e-mail
  try {
    await transporter.sendMail(mailOptions);
    console.log("E-mail de vérification envoyé avec succès");
  } catch (error) {
    console.error("Erreur lors de l'envoi de l'e-mail de vérification:", error);
  }
};
// Enregistre un nouvel utilisateur
// ... importations et configuration existantes ...

app.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Vérifiez si l'e-mail est déjà enregistré
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log("Email déjà enregistré:", email); // Déclaration de débogage
      return res.status(400).json({ message: "Email déjà enregistré" });
    }

    // Créer un nouvel User
    const newUser = new User({ name, email, password });

    // Générer et stocker le token de vérification
    newUser.verificationToken = crypto.randomBytes(20).toString("hex");

    // Enregistrez user dans la base de données
    await newUser.save();

    // Instruction de débogage pour vérifier les données
    console.log("Nouvel utilisateur enregistré:", newUser);

    // Envoie un email de vérification à l'utilisateur
    // Utilisez votre service de messagerie ou votre bibliothèque préférée pour envoyer l'e-mail
    sendVerificationEmail(newUser.email, newUser.verificationToken);

    res.status(201).json({
      message:
        "Inscription réussi. Veuillez vérifier votre courrier électronique pour la vérification.",
    });
  } catch (error) {
    console.log("Erreur lors de l'inscription:", error); // Déclaration de débogage
    res.status(500).json({ message: "Échec de l'enregistrement" });
  }
});

//endpoint pour vérifier l'e-mail
app.get("/verify/:token", async (req, res) => {
  try {
    const token = req.params.token;

    //Trouver User avec le token de vérification donné
    const user = await User.findOne({ verificationToken: token });
    if (!user) {
      return res.status(404).json({ message: "Invalid verification token" });
    }

    //Marquer l'utilisateur comme vérifié
    user.verified = true;
    user.verificationToken = undefined;

    await user.save();

    res.status(200).json({ message: "E-mail vérifié avec succès" });
  } catch (error) {
    res.status(500).json({ message: "Échec de la vérification de l'e-mail" });
  }
});

const generateSecretKey = () => {
  const secretKey = crypto.randomBytes(32).toString("hex");

  return secretKey;
};

const secretKey = generateSecretKey();

//endpoint final pour connecter user !
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    //vérifier si l'utilisateur existe
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(401)
        .json({ message: "email ou mot de passe invalide" });
    }

    //vérifiez si le mot de passe est correct
    if (user.password !== password) {
      return res.status(401).json({ message: "Mot de passe incorrect" });
    }

    //générer un token
    const token = jwt.sign({ userId: user._id }, secretKey);

    res.status(200).json({ token });
  } catch (error) {
    res.status(500).json({ message: "La connexion a échoué" });
  }
});

//endpoint pour stocker une nouvelle adresse dans le backend
app.post("/addresses", async (req, res) => {
  try {
    const { userId, address } = req.body;

    //trouver user par l'ID user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User non trouvé" });
    }

    //ajouter la nouvelle adresse au tableau d'adresses de User
    user.addresses.push(address);

    //enregistrer User mis à jour dans le backend
    await user.save();

    res.status(200).json({ message: "Adresse créée avec succès" });
  } catch (error) {
    res.status(500).json({ message: "Erreur lors de l'ajout de l'adresse" });
  }
});

//endpoint final pour obtenir toutes les adresses d'un User particulier
app.get("/addresses/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    const addresses = user.addresses;
    res.status(200).json({ addresses });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Erreur lors de la récupération des adresses" });
  }
});

//endpoint pour stocker toutes les commandes
app.post("/orders", async (req, res) => {
  try {
    const { userId, cartItems, totalPrice, shippingAddress, paymentMethod } =
      req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    //créer un tableau d'objets produits à partir du paniers
    const products = cartItems.map((item) => ({
      name: item?.title,
      quantity: item.quantity,
      price: item.price,
      image: item?.image,
    }));

    //créer une nouvelle commande
    const order = new Order({
      user: userId,
      products: products,
      totalPrice: totalPrice,
      shippingAddress: shippingAddress,
      paymentMethod: paymentMethod,
    });

    await order.save();

    res.status(200).json({ message: "Commande créée avec succès !" });
  } catch (error) {
    console.log("erreur lors de la création des commandes", error);
    res
      .status(500)
      .json({ message: "Erreur lors de la création des commandes" });
  }
});

//obtenir le profil User
app.get("/profile/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    res.status(200).json({ user });
  } catch (error) {
    res.status(500).json({
      message: "Erreur lors de la récupération du profil utilisateur",
    });
  }
});

app.get("/orders/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;

    const orders = await Order.find({ user: userId }).populate("user");

    if (!orders || orders.length === 0) {
      return res
        .status(404)
        .json({ message: "Aucune commande trouvée pour cet utilisateur" });
    }

    res.status(200).json({ orders });
  } catch (error) {
    res.status(500).json({ message: "Erreur" });
  }
});
