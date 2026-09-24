export default function HomePage() {
  return (
    <main className="marg-dashboard">
      <nav className="marg-nav">
        <div className="marg-nav-inner">
          <a href="/" className="marg-logo">
            <span className="marg-logo-mark" />
            Marg.ai
          </a>

          <div className="marg-nav-links">
            <a href="/login" className="marg-nav-link">
              Log in
            </a>

            <a href="/register" className="marg-btn marg-btn-primary">
              Get started
            </a>
          </div>
        </div>
      </nav>

      <section className="marg-hero">
        <div className="marg-container">
          <div style={{ maxWidth: 850 }}>
            <div className="marg-page-eyebrow" style={{ color: "#ffffff" }}>
              PERSONALIZED LEARNING
            </div>

            <h1>
              Find your path.
              <br />
              Learn what matters.
            </h1>

            <p
              style={{
                maxWidth: 620,
                marginTop: 24,
                fontSize: 19,
                lineHeight: 1.6,
              }}
            >
              Marg.ai understands what you know, finds the gaps in your
              knowledge, and builds a learning path around you.
            </p>

            <div
              style={{
                display: "flex",
                gap: 12,
                marginTop: 32,
                flexWrap: "wrap",
              }}
            >
              <a
                href="/register"
                className="marg-btn"
                style={{
                  background: "#ffffff",
                  color: "#202020",
                }}
              >
                Start learning
              </a>

              <a
                href="/login"
                className="marg-btn"
                style={{
                  border: "1px solid rgba(255,255,255,0.55)",
                  color: "#ffffff",
                }}
              >
                Log in
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="marg-section">
        <div className="marg-container">
          <div style={{ maxWidth: 680, marginBottom: 40 }}>
            <div className="marg-page-eyebrow">HOW IT WORKS</div>

            <h2>Your learning path adapts to you.</h2>

            <p
              style={{
                marginTop: 18,
                color: "var(--marg-muted)",
                fontSize: 17,
              }}
            >
              Start with a syllabus or a single topic. Marg.ai maps the
              concepts, identifies what you already understand, and guides you
              through what comes next.
            </p>
          </div>

          <div className="marg-grid marg-grid-3">
            <article className="marg-card marg-card-padding marg-card-hover">
              <span className="marg-tag marg-tag-orange">01</span>

              <h3 style={{ marginTop: 24 }}>Understand</h3>

              <p
                style={{
                  marginTop: 12,
                  color: "var(--marg-muted)",
                }}
              >
                Build a picture of your knowledge from your syllabus and
                assessments.
              </p>
            </article>

            <article className="marg-card marg-card-padding marg-card-hover">
              <span className="marg-tag marg-tag-orange">02</span>

              <h3 style={{ marginTop: 24 }}>Find gaps</h3>

              <p
                style={{
                  marginTop: 12,
                  color: "var(--marg-muted)",
                }}
              >
                Discover the concepts and prerequisites that need more
                attention.
              </p>
            </article>

            <article className="marg-card marg-card-padding marg-card-hover">
              <span className="marg-tag marg-tag-orange">03</span>

              <h3 style={{ marginTop: 24 }}>Learn</h3>

              <p
                style={{
                  marginTop: 12,
                  color: "var(--marg-muted)",
                }}
              >
                Follow a personalized path with explanations, practice, and
                reassessment.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="marg-dark-section marg-section-lg">
        <div className="marg-container">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 64,
              alignItems: "center",
            }}
          >
            <div>
              <div
                className="marg-page-eyebrow"
                style={{ color: "#ea2804" }}
              >
                KNOWLEDGE GRAPH
              </div>

              <h2 style={{ color: "#ffffff" }}>
                Learn the connections,
                <br />
                not just the topics.
              </h2>
            </div>

            <div>
              <p
                style={{
                  color: "rgba(255,255,255,0.68)",
                  fontSize: 17,
                  lineHeight: 1.7,
                }}
              >
                Marg.ai models concepts and their relationships so that
                learning can follow prerequisites instead of treating every
                topic as an isolated chapter.
              </p>

              <div className="marg-code" style={{ marginTop: 28 }}>
                <div>SYLLABUS</div>
                <div style={{ color: "#ea2804" }}>↓</div>
                <div>CONCEPTS</div>
                <div style={{ color: "#ea2804" }}>↓</div>
                <div>KNOWLEDGE GRAPH</div>
                <div style={{ color: "#ea2804" }}>↓</div>
                <div>KNOWLEDGE GAPS</div>
                <div style={{ color: "#ea2804" }}>↓</div>
                <div>PERSONALIZED PATH</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="marg-section">
        <div className="marg-container">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 32,
              padding: "40px 0",
              borderTop: "1px solid var(--marg-border)",
              borderBottom: "1px solid var(--marg-border)",
            }}
          >
            <div>
              <div className="marg-page-eyebrow">READY?</div>

              <h2>Start building your path.</h2>
            </div>

            <a href="/register" className="marg-btn marg-btn-primary">
              Create your account
            </a>
          </div>
        </div>
      </section>

      <footer
        style={{
          padding: "28px 0",
          borderTop: "1px solid var(--marg-border)",
        }}
      >
        <div
          className="marg-container"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
          }}
        >
          <span
            style={{
              fontWeight: 700,
              letterSpacing: "-0.04em",
            }}
          >
            Marg.ai
          </span>

          <span
            style={{
              color: "var(--marg-muted)",
              fontSize: 13,
            }}
          >
            Find your path.
          </span>
        </div>
      </footer>
    </main>
  );
}