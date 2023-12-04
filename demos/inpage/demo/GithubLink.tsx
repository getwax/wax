import githubLogoUrl from './githubLogo.svg';

const GithubLink = () => (
  <a href="https://github.com/getwax/wax/tree/main/demos/inpage">
    <img
      src={githubLogoUrl}
      alt="github"
      style={{ width: '0.75em', margin: '0 0.2em' }}
    />
  </a>
);

export default GithubLink;
