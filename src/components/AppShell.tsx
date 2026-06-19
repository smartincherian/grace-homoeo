import { useState, type MouseEvent, type ReactNode } from "react";
import {
  AppBar,
  Box,
  BottomNavigation,
  BottomNavigationAction,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  ListItemText as MenuItemText,
  Stack,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import PeopleIcon from "@mui/icons-material/People";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import PaidIcon from "@mui/icons-material/Paid";
import CalculateIcon from "@mui/icons-material/Calculate";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { useAuth } from "../features/auth/useAuth";
import { PageChromeProvider, usePageTitle } from "./PageChrome";
import Mandala from "./Mandala";

const NAV = [
  { to: "/patients", label: "Patients", icon: <PeopleIcon /> },
  { to: "/inventory", label: "Inventory", icon: <Inventory2Icon /> },
  { to: "/calculator", label: "Calculator", icon: <CalculateIcon /> },
  { to: "/funds", label: "Funds", icon: <PaidIcon /> },
];
const DRAWER_WIDTH = 240;

function ShellInner({ children }: { children?: ReactNode }) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const { pathname } = useLocation();
  const current = NAV.find((n) => pathname.startsWith(n.to))?.to ?? "/patients";
  const isRoot = NAV.some((n) => n.to === pathname);
  const navigate = useNavigate();
  const { user } = useAuth();
  const pageTitle = usePageTitle();
  const navLabel = NAV.find((n) => n.to === current)?.label;
  const title = pageTitle || navLabel || "Grace Homoeo";

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const openMenu = (e: MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
  const closeMenu = () => setAnchorEl(null);
  const handleSignOut = async () => {
    closeMenu();
    await signOut(auth);
    navigate("/login", { replace: true });
  };

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar
        position="fixed"
        sx={{ zIndex: (t) => t.zIndex.drawer + 1, overflow: "hidden" }}
      >
        <Mandala
          size={120}
          color="#7FB4FF"
          opacity={0.18}
          sx={{ position: "absolute", top: -36, right: -24, zIndex: 0 }}
        />
        <Toolbar variant="dense" sx={{ position: "relative", zIndex: 1 }}>
          {!isRoot && (
            <IconButton
              color="inherit"
              aria-label="back"
              edge="start"
              onClick={() => navigate(-1)}
              sx={{ mr: 1 }}
            >
              <ArrowBackIcon />
            </IconButton>
          )}
          <Typography variant="h6" sx={{ flexGrow: 1 }} noWrap>
            {title}
          </Typography>
          <IconButton color="inherit" aria-label="account" onClick={openMenu}>
            <AccountCircleIcon />
          </IconButton>
          <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={closeMenu}>
            {user?.email && (
              <MenuItem disabled>
                <MenuItemText primary={user.email} />
              </MenuItem>
            )}
            <MenuItem onClick={handleSignOut}>Sign out</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {isDesktop && (
        <Drawer
          variant="permanent"
          sx={{
            width: DRAWER_WIDTH,
            "& .MuiDrawer-paper": { width: DRAWER_WIDTH },
          }}
        >
          <Toolbar variant="dense" />
          <Stack
            direction="row"
            alignItems="center"
            spacing={1}
            sx={{ px: 2, py: 2 }}
          >
            <Mandala size={28} color="#150E56" opacity={0.9} />
            <Typography sx={{ fontWeight: 700, color: "primary.main" }}>
              Grace Homoeo
            </Typography>
          </Stack>
          <List sx={{ px: 1 }}>
            {NAV.map((n) => (
              <ListItemButton
                key={n.to}
                component={Link}
                to={n.to}
                selected={current === n.to}
              >
                <ListItemIcon>{n.icon}</ListItemIcon>
                <ListItemText primary={n.label} />
              </ListItemButton>
            ))}
          </List>
        </Drawer>
      )}

      <Box component="main" sx={{ flexGrow: 1, p: 2, pb: isDesktop ? 2 : 9 }}>
        <Toolbar variant="dense" />
        {children ?? <Outlet />}
      </Box>

      {!isDesktop && (
        <BottomNavigation
          value={current}
          showLabels
          sx={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: (t) => t.zIndex.drawer + 1,
          }}
        >
          {NAV.map((n) => (
            <BottomNavigationAction
              key={n.to}
              component={Link}
              to={n.to}
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
