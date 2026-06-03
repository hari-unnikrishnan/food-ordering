import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./RestaurantLogin.css";
import { Eye, EyeOff } from "lucide-react";
import google from "./assets/google.png";
import apple from "./assets/apple.png";

export default function RestaurantLogin() {

  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);

  const defaultCredentials = useMemo(
    () => ({
      username: "admin1",
      password: "admin123",
    }),
    []
  );

  const handleLogin = (e) => {
    e.preventDefault();

    console.log("Login Clicked");

    navigate("/");
  };

  return (
    <div className="fresh-login-page">

      {/* LEFT */}
      <div className="fresh-side-left">

        <div className="fresh-dark-panel">
          <div className="fresh-brand-logo">
            <span>Restaurant</span>
          </div>
        </div>

        <div className="fresh-food fresh-food-large"></div>
        <div className="fresh-food fresh-food-medium"></div>
        <div className="fresh-food fresh-food-small"></div>

      </div>

      {/* RIGHT */}
      <div className="fresh-side-right">

        <div className="fresh-wave-shape"></div>

        <div className="fresh-auth-box">

          <h1>Let's Sign In.!</h1>

          <p className="subheading">
            Login to Your Account to Continue your Restaurant
          </p>

          <form className="fresh-auth-form" onSubmit={handleLogin}>

            <input
              type="text"
              placeholder="E-mail/username"
              defaultValue={defaultCredentials.username}
            />

            <div className="fresh-password-wrap">

              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                defaultValue={defaultCredentials.password}
              />

              <button
                type="button"
                className="fresh-password-eye"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff size={20} />
                ) : (
                  <Eye size={20} />
                )}
              </button>

            </div>

            <div className="fresh-forgot-link">
              Forgot your password?
            </div>

            <button type="submit" style={{background:"#f3ad43"}}>
              Login
            </button>

          </form>

          <div className="fresh-divider">
            <span></span>
            Or Continue With
            <span></span>
          </div>

          <div className="fresh-social-buttons">
            <button type="button"> <img src={google} alt="google" className="social-iconz" /> Google</button>
            <button type="button"> <img src={apple} alt="apple" className="social-icon" /> Apple</button>
          </div>

          <div className="fresh-register-text">
            Don't have an Account??
            <a href="#"> Sign up</a>
          </div>

        </div>

      </div>

    </div>
  );
}