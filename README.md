<p align="center">
  <img src="https://raw.githubusercontent.com/github/explore/main/topics/api/api.png" width="120" alt="ManageCharge Logo" />
</p>

<h1 align="center">ManageCharge</h1>

<p align="center">
  Plataforma integral para la gestión, control y visualización de cargos, consumos y operaciones financieras.
</p>

<p align="center">
  <strong>Monorepo</strong> · API · Web · Mobile
</p>

---

## 📌 Descripción general

**ManageCharge** es una plataforma tecnológica diseñada para centralizar y automatizar la gestión de cargos, consumos y transacciones, ofreciendo una arquitectura moderna, escalable y multiplataforma.

Este repositorio utiliza un enfoque **monorepo**, donde se desarrollan de forma organizada e independiente:

- Un **API backend**
- Un **frontend web**
- Una **aplicación móvil**

Todos conviven en un mismo repositorio para facilitar el versionado, la integración y el despliegue.

---

## 🧱 Arquitectura del repositorio

```txt
managecharge/
├── managecharge-api/     # Backend API (NestJS)
├── managecharge-web/     # Frontend Web (React / Next.js)
├── managecharge-app/     # App móvil (Flutter)
├── .gitignore
└── README.md
