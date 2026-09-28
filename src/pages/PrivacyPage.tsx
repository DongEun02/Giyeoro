const CONTACT_EMAIL = "imde0205@gmail.com";

export function PrivacyPage() {
  return (
    <article className="privacy-page animate-fade-in">
      <header className="privacy-hero">
        <span>Privacy Policy</span>
        <h1>개인정보 처리방침</h1>
        <p>기여로는 서비스 제공에 필요한 최소한의 정보만 처리합니다.</p>
        <small>시행일: 2026년 9월 28일</small>
      </header>

      <div className="privacy-content">
        <section>
          <h2>1. 수집하는 정보</h2>
          <p>GitHub 로그인과 서비스 이용 과정에서 다음 정보를 수집하거나 저장할 수 있습니다.</p>
          <ul>
            <li>GitHub 사용자 ID, 사용자 이름, 표시 이름, 프로필 이미지 및 프로필 주소</li>
            <li>사용자가 작성한 공개 Pull Request의 저장소, 제목, 본문 요약, 상태, 변경 규모 및 관련 공개 메타데이터</li>
            <li>공개 또는 숨김 처리한 프로젝트와 PR 설정, 마지막 동기화 시각</li>
            <li>로그인 상태 유지를 위한 세션 쿠키와 서비스 이용 중 생성되는 최소한의 접속 정보</li>
          </ul>
          <p>기여로는 비공개 저장소 접근 권한을 요청하지 않으며, 비공개 저장소의 코드나 PR을 수집하지 않습니다.</p>
        </section>

        <section>
          <h2>2. 이용 목적</h2>
          <ul>
            <li>GitHub 계정 확인과 로그인 상태 유지</li>
            <li>공개 PR 자동 동기화 및 프로젝트별 기여 이력 구성</li>
            <li>사용자가 선택한 공개 포트폴리오 제공</li>
            <li>서비스 안정성 확인과 오류 대응</li>
          </ul>
        </section>

        <section>
          <h2>3. 보관 및 파기</h2>
          <p>수집한 정보는 서비스 제공에 필요한 기간 동안 보관합니다. 이용 목적이 사라지거나 사용자의 삭제 요청이 확인되면 관련 법령상 보관 의무가 있는 경우를 제외하고 지체 없이 파기합니다.</p>
        </section>

        <section>
          <h2>4. 외부 서비스 이용</h2>
          <p>기여로는 GitHub OAuth와 GitHub API를 통해 공개 프로필 및 공개 PR 정보를 확인합니다. 서비스 운영과 데이터 저장을 위해 호스팅 및 데이터베이스 제공 업체의 인프라를 사용할 수 있습니다.</p>
        </section>

        <section>
          <h2>5. 공개 포트폴리오</h2>
          <p>공개 포트폴리오에는 GitHub에서 병합이 확인되고 사용자가 숨기지 않은 PR만 표시됩니다. 공개 페이지에는 GitHub 사용자 이름, 프로필 이미지, 저장소와 PR 정보가 포함될 수 있습니다.</p>
        </section>

        <section>
          <h2>6. 문의 및 권리 행사</h2>
          <p>개인정보 열람, 정정, 삭제 또는 처리와 관련된 문의는 아래 이메일로 보내주세요.</p>
          <a className="privacy-contact" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </section>

        <section>
          <h2>7. 방침 변경</h2>
          <p>서비스 기능이나 관련 기준이 변경되면 이 방침도 수정될 수 있습니다. 중요한 변경 사항은 서비스 화면을 통해 안내합니다.</p>
        </section>
      </div>
    </article>
  );
}
