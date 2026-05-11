import type { LoaderFunctionArgs } from "react-router";
import { redirect, Form, useLoaderData } from "react-router";

import { login } from "../../shopify.server";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>
          Carboniq — Bilan carbone pour votre boutique
        </h1>
        <p className={styles.text}>
          Calculez, affichez et compensez l'empreinte CO₂ de vos produits.
          Conforme EU Green Claims 2027.
        </p>
        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Domaine de votre boutique</span>
              <input
                className={styles.input}
                type="text"
                name="shop"
                placeholder="ma-boutique.myshopify.com"
              />
            </label>
            <button className={styles.button} type="submit">
              Se connecter
            </button>
          </Form>
        )}
        <ul className={styles.list}>
          <li>
            <strong>Score CO₂ automatique</strong>. Chaque produit reçoit un
            score carbone basé sur la base ADEME, affiché directement sur votre
            storefront.
          </li>
          <li>
            <strong>Compensation carbone</strong>. Proposez à vos clients de
            compenser l'impact de leur commande avec un certificat d'impact
            vérifiable.
          </li>
          <li>
            <strong>Conformité EU 2027</strong>. Scanner Green Claims, Digital
            Product Passport et rapports RSE pour anticiper la réglementation
            européenne.
          </li>
        </ul>
      </div>
    </div>
  );
}
