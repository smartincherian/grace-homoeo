import { useState, type MouseEvent, type ReactNode } from "react";
import {
  Box,
  BottomNavigation,
  BottomNavigationAction,
  ButtonBase,
  IconButton,
  Menu,
  MenuItem,
  ListItemText as MenuItemText,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import PeopleIcon from "@mui/icons-material/PeopleOutline";
import Inventory2Icon from "@mui/icons-material/Inventory2Outlined";
import PaidIcon from "@mui/icons-material/CreditCardOutlined";
import CalculateIcon from "@mui/icons-material/CalculateOutlined";
import ArrowBackIcon from "@mui/icons-material/ArrowBackIosNew";
import {
  Link,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { signOut } from "firebase/auth";
import { useQueryClient } from "@tanstack/react-query";
import { auth } from "../lib/firebase";
import { useAuth } from "../features/auth/useAuth";
import { useMembership } from "../features/auth/AuthGuard";
import SetPasswordDialog, {
  hasPassword,
} from "../features/auth/SetPasswordDialog";
import { setActiveClinic } from "../lib/clinic";
import { PageChromeProvider, usePageTitle } from "./PageChrome";
import ScriptureBanner from "./ScriptureBanner";
import logo from "../assets/logo.png";
import { LINE, TOKENS, initials } from "../theme/theme";
import { canManageClinic, isSuperadmin } from "../lib/access";
import { useClinic } from "../lib/clinicQueries";

const NAV = [
  { to: "patients", label: "Patients", icon: <PeopleIcon /> },
  { to: "inventory", label: "Inventory", icon: <Inventory2Icon /> },
  { to: "calculator", label: "Calculator", icon: <CalculateIcon /> },
  { to: "funds", label: "Funds", icon: <PaidIcon /> },
];
const SIDEBAR_WIDTH = 244;

function LogoTile({ size = 36 }: { size?: number }) {
  return (
    <Box
      sx={{
        width: size,
        height: size,
        flex: "none",
        borderRadius: `${Math.round(size * 0.3)}px`,
        background: "linear-gradient(135deg, var(--brand-300), var(--brand))",
        color: "#fff",
        display: "grid",
        placeItems: "center",
        fontWeight: 800,
        fontSize: size * 0.44,
      }}
    >
      G
    </Box>
  );
}

function ShellInner({ children }: { children?: ReactNode }) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const { pathname } = useLocation();
  // Undefined outside a clinic (the superadmin's /admin page): no clinic nav there.
  const { clinicSlug } = useParams();
  const sectionHref = (section: string) => `/${clinicSlug}/${section}`;
  const section = pathname.split("/")[2];
  const current = NAV.find((n) => n.to === section)?.to ?? "patients";
  const isRoot = !clinicSlug || NAV.some((n) => sectionHref(n.to) === pathname);
  const membership = useMembership();
  // A member's read of another clinic would be denied; skip it.
  const canReadClinic =
    !!membership &&
    (membership.superadmin || membership.clinicId === clinicSlug);
  const clinicName = useClinic(canReadClinic ? clinicSlug : undefined).data
    ?.name;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const superadmin = isSuperadmin(user?.email);
  const homeHref = superadmin
    ? "/admin"
    : clinicSlug
      ? sectionHref("patients")
      : "/";
  const pageTitle = usePageTitle();
  const userName = user?.displayName || user?.email?.split("@")[0] || "Account";

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const openMenu = (e: MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
  const closeMenu = () => setAnchorEl(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const handleSignOut = async () => {
    closeMenu();
    await signOut(auth);
    queryClient.clear();
    setActiveClinic(null);
    navigate("/login", { replace: true });
  };

  const avatar = (
    <Box
      sx={{
        width: 32,
        height: 32,
        flex: "none",
        borderRadius: "50%",
        bgcolor: TOKENS.blue100,
        color: TOKENS.blue700,
        display: "grid",
        placeItems: "center",
        fontWeight: 700,
        fontSize: 13,
      }}
    >
      {initials(userName)}
    </Box>
  );

  const accountMenu = (
    <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={closeMenu}>
      {user?.email && (
        <MenuItem disabled>
          <MenuItemText primary={user.email} />
        </MenuItem>
      )}
      {superadmin && (
        <MenuItem
          onClick={() => {
            closeMenu();
            navigate("/admin");
          }}
        >
          Admin
        </MenuItem>
      )}
      {canManageClinic(membership, clinicSlug) && (
        <MenuItem
          onClick={() => {
            closeMenu();
            navigate(sectionHref("people"));
          }}
        >
          People
        </MenuItem>
      )}
      {user && !hasPassword(user) && (
        <MenuItem
          onClick={() => {
            closeMenu();
            setPasswordOpen(true);
          }}
        >
          Set password
        </MenuItem>
      )}
      <MenuItem onClick={handleSignOut}>Sign out</MenuItem>
    </Menu>
  );
  // Mounted only while open, so the shell itself never needs the toast context.
  const passwordDialog = user && passwordOpen && (
    <SetPasswordDialog
      open
      user={user}
      onClose={() => setPasswordOpen(false)}
    />
  );

  if (isDesktop) {
    return (
      <Box
        sx={{
          display: "flex",
          minHeight: "100vh",
          bgcolor: "background.default",
        }}
      >
        <Box
          component="aside"
          sx={{
            width: SIDEBAR_WIDTH,
            flex: "none",
            position: "sticky",
            top: 0,
            height: "100vh",
            bgcolor: TOKENS.white,
            borderRight: LINE,
            px: 2,
            py: 3,
            display: "flex",
            flexDirection: "column",
            gap: 3.5,
          }}
        >
          <Box
            component={Link}
            to={homeHref}
            sx={{ display: "block", px: 1.5, pt: 0.5 }}
          >
            <Box
              component="img"
              src={logo}
              alt="Grace Homoeo Clinic"
              sx={{
                display: "block",
                width: "100%",
                maxWidth: 176,
                height: "auto",
                mx: "auto",
              }}
            />
            {clinicName && (
              <Typography
                noWrap
                sx={{
                  mt: 1,
                  textAlign: "center",
                  fontSize: 13,
                  fontWeight: 600,
                  color: TOKENS.muted,
                }}
              >
                {clinicName}
              </Typography>
            )}
          </Box>
          {clinicSlug && (
            <Box
              component="nav"
              sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}
            >
              {NAV.map((n) => {
                const active = current === n.to;
                return (
                  <Box
                    key={n.to}
                    component={Link}
                    to={sectionHref(n.to)}
                    aria-current={active ? "page" : undefined}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                      px: 1.5,
                      py: 1.25,
                      borderRadius: "12px",
                      fontSize: 14,
                      fontWeight: active ? 700 : 500,
                      color: active ? TOKENS.blue700 : TOKENS.muted,
                      bgcolor: active ? TOKENS.blue50 : "transparent",
                      textDecoration: "none",
                      "& svg": { fontSize: 20 },
                      "&:hover": {
                        bgcolor: active ? TOKENS.blue50 : TOKENS.ground,
                      },
                    }}
                  >
                    {n.icon}
                    {n.label}
                  </Box>
                );
              })}
            </Box>
          )}
          <ButtonBase
            aria-label="account"
            onClick={openMenu}
            sx={{
              mt: "auto",
              justifyContent: "flex-start",
              gap: 1.25,
              px: 1,
              py: 0.75,
              borderRadius: "12px",
              fontSize: 14,
              fontWeight: 600,
              "&:hover": { bgcolor: TOKENS.ground },
            }}
          >
            {avatar}
            <Box
              component="span"
              sx={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {userName}
            </Box>
          </ButtonBase>
          {accountMenu}
          {passwordDialog}
        </Box>

        <Box
          component="main"
          sx={{
            flex: 1,
            minWidth: 0,
            px: 4,
            pt: 3.5,
            pb: 1.5,
            display: "flex",
            flexDirection: "column",
            minHeight: "100vh",
          }}
        >
          {!isRoot && (
            <ButtonBase
              aria-label="back"
              onClick={() => navigate(-1)}
              sx={{
                alignSelf: "flex-start",
                gap: 1.25,
                mb: 2.5,
                height: 40,
                pl: 0.5,
                pr: 2,
                borderRadius: "99px",
                bgcolor: TOKENS.white,
                border: LINE,
                boxShadow: "0 1px 2px rgba(20,26,46,.06)",
                fontSize: 14,
                fontWeight: 700,
                color: TOKENS.ink,
                transition: "background-color .15s, border-color .15s",
                "& .back-badge": { transition: "transform .15s" },
                "&:hover": {
                  bgcolor: TOKENS.blue50,
                  borderColor: TOKENS.blue200,
                  "& .back-badge": { transform: "translateX(-2px)" },
                },
                "&:focus-visible": {
                  outline: `2px solid ${TOKENS.blue}`,
                  outlineOffset: 2,
                },
                "@media (prefers-reduced-motion: reduce)": {
                  "& .back-badge": { transition: "none" },
                  "&:hover .back-badge": { transform: "none" },
                },
              }}
            >
              <Box
                className="back-badge"
                sx={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  bgcolor: TOKENS.blue,
                  color: "#fff",
                  display: "grid",
                  placeItems: "center",
                  boxShadow: "0 3px 8px rgba(var(--brand-rgb), .35)",
                }}
              >
                <ArrowBackIcon sx={{ fontSize: 13 }} />
              </Box>
              Back
            </ButtonBase>
          )}
          <Box sx={{ flex: 1 }}>{children ?? <Outlet />}</Box>
          <ScriptureBanner />
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <Box
        component="header"
        sx={{
          position: "sticky",
          top: 0,
          zIndex: (t) => t.zIndex.appBar,
          height: 60,
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 1.5,
          bgcolor: TOKENS.white,
          borderBottom: LINE,
        }}
      >
        {isRoot ? (
          <LogoTile size={32} />
        ) : (
          <IconButton
            aria-label="back"
            onClick={() => navigate(-1)}
            sx={{
              width: 38,
              height: 38,
              borderRadius: "12px",
              bgcolor: TOKENS.blue50,
              color: TOKENS.blue700,
              "&:hover": { bgcolor: TOKENS.blue100 },
            }}
          >
            <ArrowBackIcon sx={{ fontSize: 16 }} />
          </IconButton>
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            component="div"
            noWrap
            sx={{ fontWeight: 800, fontSize: 17 }}
          >
            {isRoot ? "Grace Homoeo" : pageTitle || "Grace Homoeo"}
          </Typography>
          {isRoot && clinicName && (
            <Typography
              noWrap
              sx={{ fontSize: 12, fontWeight: 600, color: TOKENS.muted }}
            >
              {clinicName}
            </Typography>
          )}
        </Box>
        <IconButton aria-label="account" onClick={openMenu} sx={{ p: 0.5 }}>
          {avatar}
        </IconButton>
        {accountMenu}
        {passwordDialog}
      </Box>

      <Box
        component="main"
        sx={{
          px: 2,
          pt: 2.5,
          pb: "calc(80px + env(safe-area-inset-bottom))",
          display: "flex",
          flexDirection: "column",
          minHeight: "calc(100vh - 60px)",
        }}
      >
        <Box sx={{ flex: 1 }}>{children ?? <Outlet />}</Box>
        <ScriptureBanner />
      </Box>

      {clinicSlug && (
        <BottomNavigation
          value={current}
          showLabels
          sx={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: (t) => t.zIndex.appBar,
            pb: "env(safe-area-inset-bottom)",
            boxSizing: "content-box",
          }}
        >
          {NAV.map((n) => (
            <BottomNavigationAction
              key={n.to}
              component={Link}
              to={sectionHref(n.to)}
              value={n.to}
              label={n.label}
              icon={n.icon}
            />
          ))}
        </BottomNavigation>
      )}
    </Box>
  );
}

export default function AppShell({ children }: { children?: ReactNode }) {
  return (
    <PageChromeProvider>
      <ShellInner>{children}</ShellInner>
    </PageChromeProvider>
  );
}
