# Rainmeter용 Google Calendar

[English guide](README.md)

개인 Google Calendar iCal 피드와 대한민국 공휴일을 표시하는 600 x 420 Rainmeter 달력 스킨입니다. 이전·다음 달 이동, 오늘 버튼, 유리 느낌의 색상·투명도 설정, 정각을 포함한 10분 단위 새로고침, 지정한 Chrome 프로필로 Google Calendar를 여는 더블클릭 기능을 제공합니다.

## 준비물

- Windows와 [Rainmeter](https://www.rainmeter.net/)
- 더블클릭으로 Google Calendar를 열 때 필요한 Google Chrome
- 달력 화면을 표시하는 Rainmeter **WebView2** 플러그인
- 지정한 Chrome 프로필을 여는 Rainmeter **RunCommand** 플러그인
- 화면 색상 스포이드 버튼에만 필요한 선택 사항인 [YourPicker](https://github.com/NSTechBytes/YourPicker/releases) 플러그인

스킨을 불러오기 전에 두 플러그인을 설치해 주세요. WebView2가 없으면 달력 화면이 표시되지 않고, RunCommand가 없으면 더블클릭 실행만 동작하지 않습니다.

색상 선택창 안의 스포이드를 눌렀을 때 YourPicker가 없으면 설치 안내가 표시됩니다. **설치 페이지 열기**로 공식 릴리스에 접속해 플러그인 `.rmskin`을 설치한 뒤, 안내창의 **달력 새로고침**을 누르세요. 자동으로 다운로드하거나 설치하지 않습니다. YourPicker DLL은 이 스킨에 포함하지 않으며, **RGB 편집으로 돌아가기**를 누르면 설치 없이도 팔레트와 RGB·HEX 입력을 사용할 수 있습니다.

## 릴리스 파일로 설치하기

1. [GoogleCalendar_1.1.1.rmskin](https://github.com/maxhong-1999/rainmeter-google-calendar/releases/download/v1.1.1/GoogleCalendar_1.1.1.rmskin)을 다운로드합니다.
2. 다운로드한 파일을 더블클릭하고 Rainmeter 설치 창에서 **Install**을 선택합니다.

3. `Documents\Rainmeter\Skins\GoogleCalendar\@Resources` 폴더를 엽니다.
4. 아래 방법으로 `Private.inc`와 `ChromeProfile.inc`를 수정한 다음, Rainmeter에서 `GoogleCalendar`를 새로고침합니다.

설치 파일에는 예시 설정만 들어 있습니다. 다른 사람의 일정 주소, 이메일, Chrome 프로필은 포함되지 않습니다.

v1.1.1 SHA-256: `6352CCE46CBC3D6C7C584E43FC15866A4F073EF74511F135444FF38F3165B766`

v1.1.1에는 오늘 날짜 테두리, HEX·RGB 입력, 색상 선택창 내부 스포이드와 색상 읽기 오류 수정에 더해, YourPicker 미설치 안내와 공식 설치 페이지 연결이 포함됩니다. 화면 추출에는 별도 YourPicker 설치가 필요하며 DLL은 포함하지 않습니다. 업데이트 시 기존 일정·계정 설정을 보존하도록 `VariableFiles`가 지정되어 있습니다.

## 소스 코드로 설치하기

1. 이 프로젝트 폴더를 `Documents\Rainmeter\Skins\GoogleCalendar`로 복사합니다.
2. `@Resources\Private.inc.example`을 `@Resources\Private.inc`로 복사합니다.
3. `@Resources\ChromeProfile.inc.example`을 `@Resources\ChromeProfile.inc`로 복사합니다.
4. 두 로컬 파일을 설정한 뒤 Rainmeter에서 `GoogleCalendar`를 새로고침합니다.

## 내 일정 연결하기

브라우저에서 Google Calendar를 엽니다. 표시할 달력의 **설정 및 공유** → **캘린더 통합**으로 이동한 뒤 **iCal 형식의 비공개 주소**를 복사합니다.

복사한 값을 로컬 `@Resources\Private.inc`에 넣습니다.

```ini
[Variables]
CalendarURL=PASTE_YOUR_SECRET_ICAL_URL_HERE
```

비공개 iCal 주소는 해당 피드의 일정을 읽을 수 있는 비밀값입니다. GitHub, 이슈, 스크린샷, 채팅에 올리지 마세요. 대한민국 공휴일 달력은 기본으로 함께 표시되며 개인 설정이 필요하지 않습니다.

## Chrome 계정과 프로필 설정하기

사용할 Chrome 프로필에서 `chrome://version`을 엽니다. 프로필 경로의 마지막 폴더 이름이 `Default` 또는 `Profile 1`처럼 표시됩니다. 그 폴더 이름과 열고 싶은 Google 계정을 `@Resources\ChromeProfile.inc`에 입력합니다.

```ini
[Variables]
ChromePath=C:\Program Files\Google\Chrome\Application\chrome.exe
ChromeProfileDirectory=Default
GoogleAccount=you@example.com
```

Chrome이 다른 위치에 설치된 경우에만 `ChromePath`를 바꾸면 됩니다. 달력의 빈 공간을 더블클릭하면 지정한 설정으로 Google Calendar가 열립니다. 기본 브라우저로 대체 실행하지 않도록 설계되어 있어, 설정이 잘못되었거나 RunCommand가 없으면 다른 계정으로 열리는 대신 창이 열리지 않습니다.

## 사용 방법

- 왼쪽·오른쪽 화살표로 이전 달과 다음 달을 이동합니다.
- **오늘** 버튼을 누르면 현재 달로 돌아옵니다.
- 톱니바퀴 버튼에서 배경색, 글자색, 유리 배경의 투명도를 함께 설정합니다. 설정값은 달력 화면에 로컬로 저장됩니다.
- 색상 견본을 누르면 팔레트가 열립니다. 이 창 안의 스포이드로 화면의 색을 찍으면 아래 R/G/B 값이 자동으로 채워지고 해당 배경색 또는 글자색에 바로 적용됩니다. R/G/B에 0~255 값을 직접 입력할 수도 있습니다. 화면 추출 중 `Esc`를 누르면 변경 없이 취소됩니다.
- 두 피드는 정각을 포함해 10분 단위로 새로고침됩니다. 새로고침에 실패해도 마지막으로 읽은 일정은 가능한 한 유지합니다.
- 빈 달력 공간을 더블클릭하면 지정한 Chrome 프로필로 Google Calendar를 엽니다. 버튼과 일정 링크는 원래 클릭 동작을 유지합니다.

## 문제 해결

| 증상 | 확인 방법 |
| --- | --- |
| 달력이 비어 있거나 Rainmeter include 오류가 표시됨 | `Private.inc` 파일이 있고 `[Variables]` 줄과 올바른 비공개 iCal 주소가 있는지 확인합니다. |
| 달력 화면이 보이지 않음 | Rainmeter WebView2 플러그인을 설치하거나 업데이트한 뒤 스킨을 새로고침합니다. |
| 더블클릭해도 Chrome이 열리지 않음 | RunCommand 설치 여부와 `ChromePath`, `ChromeProfileDirectory`, `GoogleAccount`을 확인한 뒤 스킨을 새로고침합니다. |
| 일정이 오래된 상태로 보임 | 다음 10분 새로고침을 기다리거나 Rainmeter에서 `GoogleCalendar`를 수동 새로고침합니다. |
| 화면 색상 스포이드가 시작되지 않음 | 미설치 안내의 **설치 페이지 열기**에서 YourPicker를 설치한 뒤 **달력 새로고침**을 누릅니다. 이미 설치했다면 Rainmeter 로그도 확인하세요. 일반 색상 선택과 RGB·HEX 입력에는 필요하지 않습니다. |
| 비공개 주소를 실수로 커밋함 | Google Calendar에서 iCal 비밀 주소를 새로 만들고, 공개 전 모든 커밋에서 해당 값을 제거합니다. |

플러그인 누락이나 INI 설정 오류는 Rainmeter 로그에서 가장 정확하게 확인할 수 있습니다.

## 업데이트와 삭제

새 `.rmskin` 파일을 기존 스킨 위에 설치하면 됩니다. 릴리스 패키지는 `Private.inc`와 `ChromeProfile.inc`를 보존하므로 개인 설정이 덮어써지지 않습니다. 삭제하려면 Rainmeter에서 스킨을 내린 뒤 `Documents\Rainmeter\Skins\GoogleCalendar` 폴더를 지우고, 더 이상 필요 없다면 두 로컬 `.inc` 파일도 함께 삭제합니다.

## 개발과 테스트

Corepack이 포함된 Node.js를 설치한 뒤, 고정된 의존성을 설치하고 테스트를 실행합니다.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm test
```

테스트는 달력 동작, Rainmeter 연동, 공개 파일 범위, 알려진 개인정보 패턴을 검사합니다. 패키지와 GitHub 릴리스 절차는 [RELEASING.md](docs/RELEASING.md)를 참고하세요.

## 기여하기

개인 설정과 내려받은 `.ics` 파일은 로컬에만 보관하세요. 예시 `.inc` 파일에서 시작하고, 동작을 바꾸면 테스트를 추가하거나 수정한 뒤 `pnpm test`를 실행해 주세요.

## 라이선스

프로젝트에서 작성한 코드는 [MIT License](LICENSE)로 제공됩니다. 포함된 `ical.js` 파서는 별도의 MPL-2.0 조건을 따르므로 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)를 확인하세요.
