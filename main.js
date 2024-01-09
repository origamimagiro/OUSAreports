import { NOTE } from "./note.js";
window.onload = () => {
    NOTE.clear_log();
    NOTE.time("*** Starting Setup ***");
    const budget_input = document.getElementById("budget");
    const trans_input = document.getElementById("trans");
    const export_div = document.getElementById("export");
    let budget_data = undefined;
    let trans_data = undefined;
    const reset = () => {
        budget_data = undefined;
        trans_data = undefined;
        while (export_div.firstChild) {
            export_div.removeChild(export_div.firstChild);
        }
    }
    const budget_file_reader = new FileReader();
    budget_input.onchange = () => {
        NOTE.time("*** Importing Budget data ***");
        if (budget_data != undefined) {
            reset();
            trans_input.value = null;
        }
        budget_file_reader.onload = () => {
            NOTE.time(`File read: ${budget_input.value}`);
            budget_data = process_budget_data(budget_file_reader.result);
            NOTE.time("*** Budget data import complete ***");
            NOTE.log("");
            if (trans_data != undefined) {
                export_data(budget_data, trans_data);
            }
        };
        budget_file_reader.readAsArrayBuffer(budget_input.files[0]);
    };
    const trans_file_reader = new FileReader();
    trans.onchange = () => {
        NOTE.time("*** Importing Transactions data ***");
        if (trans_data != undefined) {
            reset();
            budget_input.value = null;
        }
        trans_file_reader.onload = () => {
            NOTE.time(`File read: ${trans_input.value}`);
            trans_data = process_trans_data(trans_file_reader.result);
            NOTE.time("*** Transation data import complete ***");
            NOTE.log("");
            if (budget_data != undefined) {
                export_data(budget_data, trans_data);
            }
        };
        trans_file_reader.readAsArrayBuffer(trans_input.files[0]);
    };
    NOTE.time("*** Setup Complete ***");
    NOTE.log("");
};

const construct_pdf = ({rev_data, exp_data, net_data, trans_data}) => {
    const pdf = new jspdf.jsPDF({
        format: "letter",
        unit: "in",
    });
    const packaged_data = {rev: rev_data, exp: exp_data};
    const sums = {};
    const maxs = {};
    for (const cat of ["rev", "exp"]) {
        const D = packaged_data[cat];
        sums[cat] = {
            mon_act: 0,
            ytd_act: 0,
            ytd_bgt: 0,
            tot_bgt: 0,
        };
        maxs[cat] = 0;
        for (const line of D) {
            for (const field of ["mon_act", "ytd_act", "ytd_bgt", "tot_bgt"]) {
                sums[cat][field] += line[field];
            }
            if (line.tot_bgt > maxs[cat]) {
                maxs[cat] = line.tot_bgt;
            }
        }
        sums[cat] = [sums[cat].mon_act, sums[cat].ytd_act,
                     sums[cat].ytd_bgt, sums[cat].tot_bgt];
    }
    maxs.net = net_data.reduce((s, a) => {
        const m = a.mag_bgt_tot;
        return (m > s) ? m : s;
    }, 0);
    const str = {
        rev: sums.rev.map((a) => Math.round(a/1000,0)).join(","),
        exp: sums.exp.map((a) => Math.round(a/1000,0)).join(","),
        net: sums.rev.map((a, i) => {
            return Math.round((a - sums.exp[i])/1000,0);
        }).join(","),
    };
    const rev_filt = [];
    const rev_other = {tot_bgt: 0, ytd_bgt: 0, ytd_act: 0, mon_act: 0, label: "Other"};
    const rev_lim = maxs.rev * 0.15;
    for (const line of rev_data) {
        if (line.tot_bgt >= rev_lim) {
            rev_filt.push(line);
        } else {
            for (const field of ["mon_act", "ytd_act", "ytd_bgt", "tot_bgt"]) {
                rev_other[field] += line[field];
            }
        }
    }
    rev_filt.push(rev_other);

    const exp_filt = [];
    const exp_other = {tot_bgt: 0, ytd_bgt: 0, ytd_act: 0, mon_act: 0, label: "Other"};
    const exp_lim = maxs.exp * 0.12;
    for (const line of exp_data) {
        if (line.tot_bgt >= exp_lim) {
            exp_filt.push(line);
        } else {
            for (const field of ["mon_act", "ytd_act", "ytd_bgt", "tot_bgt"]) {
                exp_other[field] += line[field];
            }
        }
    }
    exp_filt.push(exp_other);

    const net_filt = [];
    const net_other = {
        dept: "Other",
        net_bgt_tot: 0,
        net_bgt_ytd: 0,
        rev_act_ytd: 0,
        exp_act_ytd: 0,
        net_act_old: 0,
    };
    const net_total = {
        dept: "Total",
        net_bgt_tot: 0,
        net_bgt_ytd: 0,
        rev_act_ytd: 0,
        exp_act_ytd: 0,
        net_act_old: 0,
    };
    const net_lim = maxs.net * 0.15;
    for (const line of net_data) {
        if (Math.abs(line.mag_bgt_tot) >= net_lim) {
            net_filt.push(line);
        } else {
            for (const field of ["net_bgt_tot", "net_bgt_ytd", "rev_act_ytd",
                "exp_act_ytd", "net_act_old",
            ]) {
                net_other[field] += line[field];
            }
        }
        for (const field of ["net_bgt_tot", "net_bgt_ytd", "rev_act_ytd",
            "exp_act_ytd", "net_act_old",
        ]) {
            net_total[field] += line[field];
        }
    }
    net_filt.push(net_other);
    net_filt.sort((a, b) => {
        const ma = a.net_bgt_tot;
        const mb = b.net_bgt_tot;
        return (ma == mb) ? 0 : ((ma < mb) ? -1 : 1);
    });
    net_filt.push(net_total);

    const trans_list = [];
    for (let i = 0; i < 15; ++i) {
        trans_list.push(trans_data[i]);
    };
    trans_list.sort((a, b) => {
        const da = a.date;
        const db = b.date;
        return (da == db) ? 0 : ((da < db) ? -1 : 1);
    });
    const largest_trans = trans_list.reduce((s, a) => {
        const ma = a.amount;
        return (ma > s) ? ma : s;
    }, -Infinity).toFixed(2);
    const date = trans_data[0].date;
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = String(date.getFullYear());
    for (const [text, x, y, size, style] of [
        [`OrigamiUSA Budget Report ${year}-${month}`, 4.25, 0.5, 11, "bold"],
        [`Revenue\n$[${str.rev}]K`, 1, 0.75, 11, "bold"],
        [`Expense\n$[${str.exp}]K`, 7.5, 0.75, 11, "bold"],
        ["$[ mon-act , ytd-act , ytd-bgt , tot-bgt ]K", 4.25, 1, 9, ""],
        [`Net Income\n$[${str.net}]K`, 4.25, 3.75, 11, "bold"],
        [`15 Largest Expenses (amt <= -$${-largest_trans})`, 4.25, 7, 11, "bold"],
    ]) {
        pdf.setFontSize(size).setFont("Helvetica", style)
            .text(text, x, y, {align: "center"}).fillStroke();
    }
    draw_pie(pdf, rev_filt, 2.2, 2.4);
    draw_pie(pdf, exp_filt, 8.5 - 2.2, 2.4);
    draw_chart(pdf, net_filt);
    draw_table(pdf, trans_list);
    return pdf;
};

const draw_pie = (pdf, budget_list, x, y) => {
    const tot = budget_list.reduce(((s, a) => s + a.tot_bgt), 0);
    const r = 1.1;
    const n = budget_list.length;
    pdf.setDrawColor("#888888").setLineWidth(0.005);
    let a1 = 0;
    for (let i = 0; i < n; ++i) {
        const { tot_bgt, ytd_bgt, ytd_act, mon_act, label } = budget_list[i];
        const percent = tot_bgt / tot;
        const a2 = a1 + percent;
        const h = 150 + i/(n - 1)*90;
        const fill = hsl2rgb(h, 1, 0.85); // L = 0.6 or 0.85
        const fill2 = hsl2rgb(h, 1, 0.6); // L = 0.6 or 0.85
        pdf.setDrawColor("#888888").setLineWidth(0.005);
        pdf.setFillColor(fill);
        draw_sector(pdf, {x, y, r, a1, a2});
        const r2 = r * (ytd_bgt / tot_bgt)**0.5;
        pdf.setFillColor(fill2);
        draw_sector(pdf, {x, y, r: r2, a1, a2});
        const r3 = r * (ytd_act / tot_bgt)**0.5;
        pdf.setDrawColor("#FF0000").setLineWidth(0.01);
        draw_arc(pdf, {x, y, r: r3, a1, a2});
        const r4 = r * ((ytd_act - mon_act) / tot_bgt)**0.5;
        pdf.setLineCap("round").setLineDashPattern([0, 0.03]);
        draw_arc(pdf, {x, y, r: r4, a1, a2});
        pdf.setLineCap("butt").setLineDashPattern([]);
        const amts = [mon_act, ytd_act, ytd_bgt, tot_bgt].map((a) => {
            return Math.round(a/1000, 0);
        }).join(",");
        const txt = `${label} ${Math.round(100*percent)}%\n$[${amts}]K`;
        const ang = (a1 + a2)*Math.PI;
        const tx = x + r*1.4*Math.cos(ang);
        const ty = y + r*1.25*Math.sin(ang);
        a1 = a2;
        if (Number.isNaN(tx) || Number.isNaN(ty)) { continue; }
        pdf.setFontSize(6).setFont("Helvetica", "")
            .text(txt, tx, ty, {baseline: "middle", align: "center"})
            .fillStroke();
    }
};

const draw_chart = (pdf, net_data) => {
    const chart_x = 1;
    const chart_y = 4;
    const chart_w = 6.75;
    const chart_h = 2.75;
    const y_step = (chart_h - 0.2)/10;
    const label_step = 20;
    let y = chart_y + 0.1;
    let label = 100;
    const x1 = chart_x;
    const x2 = x1 + chart_w;
    pdf.setFontSize(8).setFont("Helvetica", "")
       .text("Dollars ($ x1000)", chart_x + 0.1, chart_y + chart_h/2 + 0.4, {
            align: "center", baseline: "middle", angle: 90
        });
    for (let i = 0; i < 11; ++i) {
        pdf.setDrawColor("#DDDDDD").setLineWidth(0.005);
        pdf.line(x1, y, x2, y, "D");
        pdf.setDrawColor("#000000").setLineWidth(0.005);
        pdf.line(x1 - 0.02, y, x1 + 0.04, y, "D");
        pdf.setFontSize(8).setFont("Helvetica", "")
           .text(`${label}`, x1 - 0.05, y, {align: "right", baseline: "middle"});
        y += y_step;
        label -= label_step;
    };
    pdf.setLineWidth(0.005);
    pdf.setDrawColor("#000000");
    pdf.line(chart_x, chart_y, chart_x, chart_y + chart_h, "D");
    const n = net_data.length;
    const sep = 0.1;
    const y0 = chart_y + chart_h/2;
    let x = chart_x + sep;
    const bar_w = (chart_w - sep)/n - sep;
    const scale = 0.001/20*y_step;
    for (let i = 0; i < n; ++i) {
        const { dept, net_bgt_tot, net_bgt_ytd, rev_act_ytd, exp_act_ytd,
            net_act_old } = net_data[i];
        const h = 240 - i/(n - 1)*90;
        const fill = hsl2rgb(h, 1, 0.85); // L = 0.6 or 0.85
        pdf.setFillColor(fill).setDrawColor("#AAAAAA");
        const y1 = -net_bgt_tot*scale;
        pdf.rect(x, y0, bar_w, y1, "FD");
        const fill2 = hsl2rgb(h, 1, 0.6); // L = 0.6 or 0.85
        pdf.setFillColor(fill2).setDrawColor("#AAAAAA");
        const y2 = -net_bgt_ytd*scale;
        pdf.rect(x + bar_w/4, y0, bar_w/2, y2, "FD");
        pdf.setDrawColor("#000000");
        pdf.line(x, y0 + y2, x + bar_w, y0 + y2, "D");
        const net_act_ytd = rev_act_ytd - exp_act_ytd;
        const y3 = -net_act_ytd*scale;
        pdf.setDrawColor("#FF0000");
        pdf.setLineWidth(0.01);
        pdf.line(x, y0 + y3, x + bar_w, y0 + y3, "D");
        const y4 = -net_act_old*scale;
        pdf.setLineCap("round").setLineDashPattern([0, 0.03]);
        pdf.line(x, y0 + y4, x + bar_w, y0 + y4, "D");
        pdf.setLineCap("butt").setLineDashPattern([]);
        pdf.setLineWidth(0.005);
        const y5 = ((y1 < 0) ? 50 : -70)*scale*1000;
        const rev_round = Math.round(rev_act_ytd/1000, 0);
        const exp_round = Math.round(exp_act_ytd/1000, 0);
        const net_round = Math.round(net_act_ytd/1000, 0);
        pdf.setFontSize(6).setFont("Helvetica", "")
            .text(`${dept}\n$[${rev_round}-${exp_round}]K\n$${net_round}K`,
                x + bar_w/2, y0 + y5, {align: "center"});
        x += sep + bar_w;
    }
};

const draw_table = (pdf, trans_list) => {
    const table_x = 0.75;
    const table_y = 7.10;
    const widths = [0.9, 1.25, 0.75, 3.35, 0.75];
    const table_h = 3.35;
    const table_w = widths.reduce((x, tot) => tot + x);
    pdf.setDrawColor("#888888").setLineWidth(0.005);
    pdf.rect(table_x, table_y, table_w, table_h, "D");
    const headers = ["Dept", "Acct", "Date", "Description", "Amount"];
    const lines = [headers].concat(trans_list);
    const row_step = table_h/lines.length;
    let y1 = table_y;
    let fill_opt = "FD";
    for (let row = 0; row < lines.length; ++row) {
        let x1 = table_x;
        const data = lines[row];
        const line = (row == 0) ? data : [
            data.name,
            data.account,
            data.date.toLocaleDateString("en-GB", {
                day: "2-digit", month: "short", year: "numeric"
            }).split(" ").join("-"),
            data.description.substring(0, Math.min(70, data.description.length)),
            `$ ${data.amount.toFixed(2)}`,
        ];
        for (let col = 0; col < headers.length; ++ col) {
            const w = widths[col];
            const txt = line[col];
            pdf.setFillColor("#EBEBEB");
            pdf.rect(x1, y1, w, row_step, fill_opt);
            pdf.setFontSize(7).setFont("Helvetica", "")
                .text(txt, x1 + 0.1, y1 + row_step/2, {baseline: "middle"})
                .fillStroke();
            x1 += w;
        }
        y1 += row_step;
        fill_opt = "D";
    }
};

const hsl2rgb = (h, s, l) => {
    const a = s*Math.min(l, 1 - l);
    const f = (n, k = (n + h/30) % 12) => l - a*Math.max(Math.min(k - 3, 9 - k, 1), -1);
    const rgb = [f(0), f(8), f(4)].map((v) => {
        const c = Math.round(v*255);
        const hex = c.toString(16);
        return (hex.length == 1) ? "0" + hex : hex;
    });
    return "#" + rgb.join("");
};

const draw_arc = (pdf, {x, y, r, a1, a2, stroke}) => {
    const path = [];
    const tau = Math.PI*2;
    const n = Math.ceil((a2 - a1)*100);
    const step = tau*(a2 - a1)/n;
    let ang = tau*a1;
    for (let i = 0; i <= n; ++i) {
        const next = {op: (i == 0) ? "m" : "l"};
        next.c = [x + r*Math.cos(ang), y + r*Math.sin(ang)];
        ang += step;
        path.push(next);
    }
    pdf.path(path);
    pdf.stroke();
};

const draw_sector = (pdf, {x, y, r, a1, a2, fill, stroke}) => {
    const path = [{op: "m", c: [x, y]}];
    const tau = Math.PI*2;
    const n = Math.ceil((a2 - a1)*100);
    const step = tau*(a2 - a1)/n;
    let ang = tau*a1;
    for (let i = 0; i <= n; ++i) {
        const next = {op: "l"};
        next.c = [x + r*Math.cos(ang), y + r*Math.sin(ang)];
        ang += step;
        path.push(next);
    }
    path.push({op: "h", c: []});
    pdf.path(path);
    pdf.fillStroke();
};

const extract_first_sheet_name = (file, name) => {
    const workbook = XLSX.read(file);
    const sheets = workbook.SheetNames;
    if (sheets.length < 1 || sheets[0] != name) {
        NOTE.time(`ERROR: 1st sheet name not '${name}'`);
        return;
    }
    return workbook.Sheets[name];
};

const check_cobj_dept = (cobj_dept, line) => {
    if (!(
        (typeof cobj_dept == "string") &&
        (cobj_dept.length == 7) &&
        (cobj_dept[3] == "-"))
    ) {
        return;   // not a valid format
    }
    const [cobj, dept] = cobj_dept.split("-");
    if (!DEPT_MAP.has(dept)) {
        NOTE.time(`Skipping line ${line}: Department ${dept} not recognized`);
        return;
    }
    if ((cobj[0] != "4") && (cobj[0] != "5")) {
        NOTE.time(`Skipping line ${line}: Cost Obj ${cobj} neither revenue nor expense`);
        return;
    }
    const type = (cobj[0] == "4") ? "rev" : "exp";
    return {dept, cobj, type};
};

const extract_amount = (debit, credit, line) => {
    const valid_credit = !isNaN(credit);
    const valid_debit = !isNaN(debit);
    if (valid_debit && !valid_credit) {
        return - Number(debit);
    }
    if (valid_credit && !valid_debit) {
        return Number(credit);
    }
    return;
};

const excelDate_2_JSDate = (ex_date) => {
    return new Date(Math.round((ex_date - 25569)*86400*1000));
};

const process_budget_data = (file) => {
    NOTE.time("Extracting sheet from budget file");
    const sheet = extract_first_sheet_name(file, "BUDGET VS ACTUAL-ALL DEPTS NEW");
    if (sheet == undefined) { return; }

    NOTE.time("Initializing container for data");
    const out = {}; // imported data
    for (const [code, name] of DEPTS_CODE_NAME) {
        const data = {};
        data["name"] = name;
        for (const field of BUDGET_FIELDS) {
            data[field] = 0;
        }
        out[code] = data;
    }

    NOTE.time("Extracting data from sheet");
    const lines = XLSX.utils.sheet_to_json(sheet, {header: 1});
    for (let i = 0; i < lines.length; ++i) {
        const line = lines[i];
        const cobj_dept = line[1];
        const check = check_cobj_dept(cobj_dept, i);
        if (check == undefined) { continue; }
        const {dept, cobj, type} = check;

        const data = out[dept];
        for (const [col, name] of [
            [2, "_bgt_mon"],
            [3, "_act_mon"],
            [5, "_bgt_ytd"],
            [6, "_act_ytd"],
            [8, "_bgt_tot"],
        ]) {
            const key = type + name;
            data[key] += Number(line[col]);
        }
    }

    NOTE.time("Calculating additional info from imported data");
    for (const code in out) {
        const data = out[code];
        for (const s of ["bgt_tot", "bgt_ytd", "act_ytd", "act_mon"]) {
            data["net_" + s] = data["rev_" + s] - data["exp_" + s];
        }
        data["net_act_old"] = data["net_act_ytd"] - data["net_act_mon"];
        const max_rev = Math.abs(data["rev_bgt_tot"]);
        const max_exp = Math.abs(data["exp_bgt_tot"]);
        data["mag_bgt_tot"] = (max_rev < max_exp) ? max_exp : max_rev;
    }

    return out;
};

const process_trans_data = (file) => {
    NOTE.time("Extracting sheet from transaction file");
    const sheet = extract_first_sheet_name(file, "General Ledger");
    if (sheet == undefined) { return; }

    NOTE.time("Initializing container for data");
    const out = [];  // imported data

    NOTE.time("Extracting data from sheet");
    const lines = XLSX.utils.sheet_to_json(sheet, {header: 1});
    for (let i = 0; i < lines.length; ++i) {
        const line = lines[i];
        const cobj_dept = line[0];
        const check = check_cobj_dept(cobj_dept, i);
        if (check == undefined) { continue; }
        const {dept, cobj} = check;

        const amount = extract_amount(line[6], line[7], i);
        if (amount == undefined) { continue; }

        const date = excelDate_2_JSDate(line[2]);
        if (isNaN(date)) { continue; }

        const name = DEPT_MAP.get(dept);
        const account = line[1];
        const description = line[5];

        out.push({name, dept, cobj, account, date, description, amount});
    }
    out.sort((a, b) => (a.date < b.date) ? -1 : ((a.date == b.date) ? 0 : 1));
    return out;
};

const create_export_interface = (date, data) => {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = String(date.getFullYear());
    const export_div = document.getElementById("export");
    for (const [label, type, ext] of [
        ["PDF", "fig", "pdf"],
        ["Budget Summary", "Tdata", "csv"],
        ["Transactions", "trans", "csv"],
    ]) {
        const link = document.createElement("a");
        const button = document.createElement("input");
        const d = data[type] ? window.URL.createObjectURL(data[type]) : "";
        export_div.appendChild(link);
        link.appendChild(button);
        link.setAttribute("download", `${year}_${month}_${type}.${ext}`);
        link.setAttribute("href", d);
        button.setAttribute("type", "button");
        button.setAttribute("value", label);
    }
};

const export_data = (budget_data, trans_data) => {
    NOTE.time("*** Generating data outputs ***");
    const rev_data = [],
          exp_data = [],
          net_data = [];
    const budget_lines = [];
    budget_lines.push([""].concat(BUDGET_FIELDS).join(","));
    for (const [code, name] of DEPTS_CODE_NAME) {
        const data = budget_data[code];
        const line = [name];
        for (const field of BUDGET_FIELDS) {
            line.push(`$ ${data[field].toFixed(0)}`);
        }
        budget_lines.push(line.join(","));
        if (data.rev_bgt_tot > 0) {
            rev_data.push({
                tot_bgt: data.rev_bgt_tot,
                ytd_bgt: data.rev_bgt_ytd,
                ytd_act: data.rev_act_ytd,
                mon_act: data.rev_act_mon,
                label: name,
            });
        }
        if (data.exp_bgt_tot > 0) {
            exp_data.push({
                tot_bgt: data.exp_bgt_tot,
                ytd_bgt: data.exp_bgt_ytd,
                ytd_act: data.exp_act_ytd,
                mon_act: data.exp_act_mon,
                label: name,
            });
        }
        net_data.push({
            dept: name,
            net_bgt_tot: data.net_bgt_tot,
            net_bgt_ytd: data.net_bgt_ytd,
            rev_act_ytd: data.rev_act_ytd,
            exp_act_ytd: data.exp_act_ytd,
            net_act_old: data.net_act_old,
            mag_bgt_tot: data.mag_bgt_tot,
        });
    }
    for (const arr of [rev_data, exp_data]) {
        arr.sort((a, b) => {
            const ma = a.tot_bgt;
            const mb = b.tot_bgt;
            return (ma == mb) ? 0 : ((ma < mb) ? 1 : -1);
        });
    }
    net_data.sort((a, b) => {
        const ma = Math.abs(a.net_bgt_tot);
        const mb = Math.abs(b.net_bgt_tot);
        return (ma == mb) ? 0 : ((ma < mb) ? 1 : -1);
    });
    trans_data.sort((a, b) => {
        const ma = a.amount;
        const mb = b.amount;
        return (ma == mb) ? 0 : ((ma < mb) ? -1 : 1);
    });
    const pdf = construct_pdf({rev_data, exp_data, net_data, trans_data});
    trans_data.sort((a, b) => {
        const da = a.date;
        const db = b.date;
        return (da == db) ? 0 : ((da < db) ? -1 : 1);
    });
    const trans_lines = [];
    trans_lines.push(TRANS_FIELDS.join(","));
    for (const data of trans_data) {
        const line = [];
        for (const field of TRANS_FIELDS) {
            let f = data[field];
            if (field == "date") {
                f = f.toLocaleDateString("en-GB", {
                    day: "2-digit", month: "short", year: "numeric"
                }).split(" ").join("-");
            } else if (field == "description") {
                f = `"${f}"`;
            } else if (field == "amount") {
                f = `$ ${f.toFixed(2)}`;
            }
            line.push(f);
        }
        trans_lines.push(line.join(","));
    }
    const data = {
        fig: pdf.output("blob"),
        Tdata: new Blob([budget_lines.join("\n")], {type: "text/plain"}),
        trans: new Blob([trans_lines.join("\n")], {type: "text/plain"}),
    };
    create_export_interface(trans_data[0].date, data);
    NOTE.time("*** Data output generation complete ***");
};

const DEPTS_CODE_NAME = [
    ["100", "Admin"],
    ["105", "Management"],
    ["110", "Membership"],
    ["120", "Board"],
    ["130", "Fundraising"],
    ["140", "Vol. Appr."],
    ["150", "Website"],
    ["160", "Awards"],
    ["170", "Archives"],
    ["180", "Scholarship"],
    ["190", "Social Media"],
    ["200", "Source"],
    ["300", "Spec. Sess."],
    ["350", "Ref. Lib."],
    ["370", "Lend. Lib."],
    ["400", "Convention"],
    ["500", "The Paper"],
    ["510", "The Fold"],
    ["550", "Development"],
    ["600", "Exhibition"],
    ["610", "Holiday Tree"],
    ["620", "OBC"],
    ["630", "Annual Gift"],
    ["700", "Publications"],
    ["800", "PCOC"],
    ["810", "Chicago Con"],
    ["850", "COG serv."],
    ["900", "O. Connect"],
    ["910", "Video Man."],
    ["950", "Unconvention"],
    ["951", "WOD Event"],
    ["952", "FoldFest Sp"],
    ["955", "Gather"],
];

const DEPT_MAP = new Map();
for (const [code, dept] of DEPTS_CODE_NAME) {
    DEPT_MAP.set(code, dept);
}

const BUDGET_FIELDS = [
    "rev_bgt_tot",
    "rev_bgt_ytd",
    "rev_bgt_mon",
    "rev_act_ytd",
    "rev_act_mon",
    "exp_bgt_tot",
    "exp_bgt_ytd",
    "exp_bgt_mon",
    "exp_act_ytd",
    "exp_act_mon",
    "net_bgt_tot",
    "net_bgt_ytd",
    "net_act_ytd",
    "net_act_mon",
    "net_act_old",
    "mag_bgt_tot",
];

const TRANS_FIELDS = [
    "name",
    "dept",
    "cobj",
    "account",
    "date",
    "description",
    "amount",
];
