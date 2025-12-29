import React from 'react';
import { FaTwitter, FaLinkedin, FaGithub, FaInstagram } from 'react-icons/fa';

const Footer = () => {
  return (
    <footer className="footer bg-base-200 text-base-content p-10">
      <aside className="flex items-center">
        <img 
          src="/logo.png" 
          alt="Logo"
          className="h-12 w-auto"
        />
        <span className="text-2xl font-bold">On the Fly</span>
      </aside>
      <nav>
        <h6 className="footer-title">Features</h6>
        <a className="link link-hover">Audience Analysis</a>
        <a className="link link-hover">Content Generation</a>
        <a className="link link-hover">Campaign Optimization</a>
        <a className="link link-hover">Analytics & Reports</a>
      </nav>
      <nav>
        <h6 className="footer-title">Resources</h6>
        <a className="link link-hover">Blog</a>
        <a className="link link-hover">Case Studies</a>
        <a className="link link-hover">Documentation</a>
        <a className="link link-hover">API Reference</a>
      </nav>
      <nav>
        <h6 className="footer-title">Legal</h6>
        <a className="link link-hover">Terms of Service</a>
        <a className="link link-hover">Privacy Policy</a>
        <a className="link link-hover">Data Processing</a>
        <a className="link link-hover">Security</a>
      </nav>
      <nav>
        <h6 className="footer-title">Social</h6>
        <div className="grid grid-flow-col gap-4">
          <a href="https://x.com/Jivansh77" target="_blank" rel="noopener noreferrer" 
             className="text-xl hover:text-primary transition-colors">
            <FaTwitter />
          </a>
          <a href="http://linkedin.com/in/jivansh-chawla-57b812290/" target="_blank" rel="noopener noreferrer"
             className="text-xl hover:text-primary transition-colors">
            <FaLinkedin />
          </a>
          <a href="https://github.com/jivansh77" target="_blank" rel="noopener noreferrer"
             className="text-xl hover:text-primary transition-colors">
            <FaGithub />
          </a>
          <a href="https://www.instagram.com/jivansh777" target="_blank" rel="noopener noreferrer"
             className="text-xl hover:text-primary transition-colors">
            <FaInstagram />
          </a>
        </div>
        <p className="mt-4 text-sm">Stay updated with AI marketing trends!</p>
      </nav>
    </footer>
  );
};

export default Footer;