// src/pages/DeclarationPage.jsx
import ImportDeclaration from "../components/ImportDeclaration";

export default function DeclarationPage() {
  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#7B0503]" />
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8a8f90]">
              Import déclaration DGI
            </span>
          </div>
          <h1 className="page-header-title">
            Importer une déclaration PDF
          </h1>
          <p className="page-header-description">
            Déposez la déclaration fiscale (PDF). L'application extrait
            automatiquement la raison sociale, l'adresse et le montant
            non payé, puis résout le client dans votre configuration.
          </p>
        </div>
      </div>

      <ImportDeclaration />
    </div>
  );
}