import HeaderWork from "../components/HeaderWork";

function HomePage() {
  return (
    <div className="page-container">

      {/* Page header */}

      <div className="page-header">

        <div>

          <div className="mb-2 flex items-center gap-2">

            <span className="h-2 w-2 rounded-full bg-[#7B0503]" />

            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8a8f90]">
              Nouveau traitement
            </span>

          </div>

          <h1 className="page-header-title">
            Générer des attestations
          </h1>

          <p className="page-header-description">
            Importez votre fichier Excel, vérifiez les données
            et préparez les attestations à générer.
          </p>

        </div>

      </div>

      <HeaderWork />

    </div>
  );
}

export default HomePage;